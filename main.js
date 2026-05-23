const CATEGORY_COLOR = {
  'biala-plama':  '#e53e3e',
  'bariera':      '#ed8936',
  'historia':     '#d4890a',
  'rekomendacja': '#3a7bd5',
};

function createIcon(category) {
  const color = CATEGORY_COLOR[category] || '#888';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 6px ${color}88;
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function initMap() {
  const stalowaBounds = L.latLngBounds(
    [50.490, 21.990],  // SW
    [50.640, 22.120]   // NE
  );

  const map = L.map('leaflet-map', {
    maxBounds: stalowaBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 12,
  }).setView([50.5833, 22.0500], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CartoDB'
  }).addTo(map);

  markers.forEach(m => {
    const marker = L.marker([m.lat, m.lon], { icon: createIcon(m.kategoria) });
    marker.addTo(map);
    marker.on('click', () => openPanel(m));
  });

  return map;
}

let panelDaneVisible = false;

function openPanel(m) {
  panelDaneVisible = false;
  const panel = document.getElementById('map-panel');

  panel.innerHTML = `
    <div class="marker-kategoria">${m.kategoria.replace('-', ' ')}</div>
    <div class="marker-rok">${m.rok_cytatu}</div>
    <div class="cytat serif italic">"${m.cytat}"</div>
    <div class="problem" id="panel-problem" style="display:none">
      <strong>${m.tytul}</strong>
      <p>${m.problem}</p>
    </div>
    <div class="reveal-hint" id="reveal-hint">▼ Pokaż co się nie zmieniło</div>
  `;

  document.getElementById('reveal-hint').addEventListener('click', showDane);
  setTimeout(showDane, 3000);
}

function showDane() {
  if (panelDaneVisible) return;
  panelDaneVisible = true;
  const problem = document.getElementById('panel-problem');
  const hint = document.getElementById('reveal-hint');
  if (problem) problem.style.display = 'block';
  if (hint) hint.style.display = 'none';
}

function issKontekst(lat, lon) {
  if (lat >= 49 && lat <= 55 && lon >= 14 && lon <= 24) return 'nad Polską';
  if (lat >= 35 && lat <= 72 && lon >= -10 && lon <= 40) return 'nad Europą';
  if (lat >= 0 && lat <= 35) return 'nad równikiem';
  if (lat < 0) return 'na półkuli południowej';
  return 'w pobliżu Rosji';
}

async function fetchISS() {
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    const data = await res.json();
    const lat = data.latitude.toFixed(2);
    const lon = data.longitude.toFixed(2);

    const el = document.getElementById('iss-status');
    if (el) {
      el.innerHTML = `
        <span class="iss-label">ISS teraz:</span>
        ${lat}°N, ${lon}°E
        <span class="iss-context">— ${issKontekst(data.latitude, data.longitude)}</span>
      `;
    }

    return { lat: parseFloat(lat), lon: parseFloat(lon) };
  } catch (e) {
    console.warn('ISS fetch failed:', e);
    const el = document.getElementById('iss-status');
    if (el) el.textContent = 'ISS: brak połączenia';
    return null;
  }
}

async function fetchKp() {
  try {
    const res = await fetch(
      'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'
    );
    const data = await res.json();
    // format: [{time_tag, Kp, a_running, station_count}, ...]
    for (let i = data.length - 1; i >= 0; i--) {
      const val = data[i].Kp;
      if (typeof val === 'number' && !isNaN(val)) return val;
    }
    return null;
  } catch (e) {
    console.warn('Kp fetch failed:', e);
    return null;
  }
}

const OBS_LAT = 50.5833;
const OBS_LON = 22.0500;

async function fetchNextPassage() {
  try {
    const res = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=2LE');
    const text = await res.text();
    const lines = text.trim().split('\n');
    // 2LE has no name line: lines[0] = TLE line 1, lines[1] = TLE line 2
    const satrec = satellite.twoline2satrec(lines[0].trim(), lines[1].trim());

    const obsGd = {
      longitude: OBS_LON * Math.PI / 180,
      latitude:  OBS_LAT * Math.PI / 180,
      height: 0.2,
    };

    const now = new Date();
    for (let i = 0; i < 5760; i++) { // sprawdź co 5s przez 8h
      const t = new Date(now.getTime() + i * 5000);
      const { position } = satellite.propagate(satrec, t);
      if (!position) continue;
      const gmst = satellite.gstime(t);
      const lookAngles = satellite.ecfToLookAngles(
        obsGd,
        satellite.eciToEcf(position, gmst)
      );
      if (lookAngles.elevation > 0) {
        const mins = Math.round((t.getTime() - now.getTime()) / 60000);
        if (mins < 90) return `za ${mins} min`;
        return `o ${t.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
    return null;
  } catch (e) {
    console.warn('Pass fetch failed:', e);
    return null;
  }
}

async function renderFinale() {
  const [issData, kp, nextPass] = await Promise.all([fetchISS(), fetchKp(), fetchNextPassage()]);

  let variant;
  if (kp !== null && kp >= 4) {
    variant = 'interference';
  } else if (issData && issData.lon >= 0 && issData.lon <= 40
             && issData.lat >= 35 && issData.lat <= 72) {
    variant = 'contact';
  } else {
    variant = 'silence';
  }

  const tekstEl = document.getElementById('finale-text');
  if (tekstEl) {
    const key = `finale_${variant}`;
    const kpDisplay = kp !== null ? kp.toFixed(1) : '—';
    let tekst = (narration[key] || '')
      .replace('[KP_VALUE]', kpDisplay)
      .replace('[NEXT_PASS]', nextPass ?? '—');
    tekstEl.innerHTML = `<p class="finale-text serif">${tekst}</p>`;
  }

  const daneEl = document.getElementById('space-data');
  if (daneEl) {
    const kpDisplay = kp !== null ? kp.toFixed(1) : '—';
    const issLat = issData ? `${issData.lat}°N` : '—';
    const issLon = issData ? `${issData.lon}°E` : '—';
    daneEl.innerHTML = `
      <div>ISS: ${issLat}, ${issLon}</div>
      <div>Kp index: ${kpDisplay}${kp !== null && kp >= 4 ? ' ⚡ burza magnetyczna' : ''}</div>
      ${nextPass ? `<div>Przelot nad Stalową Wolą: ${nextPass}</div>` : ''}
    `;
  }
}

function initSplitScreen() {
  const slider = document.getElementById('split-slider');
  const before = document.querySelector('.split-before');
  const beforeImg = before?.querySelector('img');
  const afterImg = document.querySelector('.split-after img');

  if (beforeImg && !beforeImg.src.includes('http')) {
    before.style.background = '#2a1810';
    beforeImg.style.display = 'none';
  }
  if (afterImg && !afterImg.src.includes('http')) {
    document.querySelector('.split-after').style.background = '#101828';
    afterImg.style.display = 'none';
  }

  if (!slider || !before) return;
  slider.addEventListener('input', (e) => {
    before.style.clipPath = `inset(0 ${100 - e.target.value}% 0 0)`;
  });
  before.style.clipPath = `inset(0 50% 0 0)`;
}

function initScrollAnimations() {
  const elements = document.querySelectorAll('#archiwum, #final, .map-panel');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('intro-narration').textContent = narration.intro;
  document.getElementById('map-panel').innerHTML =
    '<p class="panel-placeholder">Kliknij znacznik na mapie, aby zobaczyć historię tego miejsca.</p>';

  initMap();
  initSplitScreen();
  initScrollAnimations();

  fetchISS();
  setInterval(fetchISS, 5000);

  const finalObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      renderFinale();
      finalObserver.disconnect();
    }
  }, { threshold: 0.3 });

  finalObserver.observe(document.getElementById('final'));
});
