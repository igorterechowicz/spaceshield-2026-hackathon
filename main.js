let demoMode = false;
const DEMO_VARIANTS = ['contact', 'silence', 'interference'];
const demoVariant = DEMO_VARIANTS[Math.floor(Math.random() * DEMO_VARIANTS.length)];

function getDemoData(variant) {
  if (variant === 'contact') {
    return { issData: { lat: 50.58, lon: 22.05 }, kp: 1.5, nextPass: 'za 12 min' };
  }
  if (variant === 'interference') {
    return { issData: { lat: 51.12, lon: 23.44 }, kp: 5.3, nextPass: 'za 45 min' };
  }
  return { issData: { lat: -10.22, lon: 135.44 }, kp: 0.7, nextPass: null };
}

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
      border: 2px solid rgba(255,255,255,0.8);
      border-radius: 50%;
      position: relative;
      color: ${color};
    "><div class="marker-ring"></div></div>`,
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

  document.getElementById('reveal-hint').addEventListener('click', showData);
  setTimeout(showData, 3000);
}

function showData() {
  if (panelDaneVisible) return;
  panelDaneVisible = true;
  const problem = document.getElementById('panel-problem');
  const hint = document.getElementById('reveal-hint');
  if (problem) problem.style.display = 'block';
  if (hint) hint.style.display = 'none';
}

function issKontekst(lat, lon) {

  // Polska
  if (lat >= 49.0 && lat <= 54.9 &&
      lon >= 14.0 && lon <= 24.5) {
    return 'nad Polską';
  }

  // Europa
  if (lat >= 35 && lat <= 72 &&
      lon >= -10 && lon <= 40) {
    return 'nad Europą';
  }

  // Afryka
  if (lat >= -35 && lat < 37 &&
      lon >= -20 && lon <= 55) {
    return 'nad Afryką';
  }

  // Azja
  if (lat >= 5 && lat <= 80 &&
      lon > 40 && lon <= 180) {
    return 'nad Azją';
  }

  // Ameryka Północna
  if (lat >= 15 && lat <= 75 &&
      lon >= -170 && lon <= -50) {
    return 'nad Ameryką Północną';
  }

  // Ameryka Południowa
  if (lat >= -60 && lat < 15 &&
      lon >= -90 && lon <= -30) {
    return 'nad Ameryką Południową';
  }

  // Australia i Oceania
  if (lat >= -50 && lat <= 0 &&
      lon >= 110 && lon <= 180) {
    return 'nad Australią i Oceanią';
  }

  // Antarktyda
  if (lat < -60) {
    return 'nad Antarktydą';
  }

  // Ocean / brak dopasowania
  return 'nad oceanem';
}

async function fetchISS() {
  if (demoMode) {
    const { issData } = getDemoData(demoVariant);
    const locLabel = demoVariant === 'contact' ? 'nad Polską'
                   : demoVariant === 'interference' ? 'nad Europą'
                   : 'nad Pacyfikiem';
    const el = document.getElementById('iss-status');
    if (el) el.innerHTML = `[DEMO] ISS teraz: ${issData.lat}°N, ${issData.lon}°E — ${locLabel}`;
    return issData;
  }
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lat = data.latitude.toFixed(2);
    const lon = data.longitude.toFixed(2);

    const el = document.getElementById('iss-status');
    if (el) {
      el.innerHTML = `ISS teraz: ${lat}°N, ${lon}°E — ${issKontekst(data.latitude, data.longitude)}`;
    }

    return { lat: parseFloat(lat), lon: parseFloat(lon) };
  } catch (e) {
    console.warn('ISS fetch failed:', e);
    const el = document.getElementById('iss-status');
    if (el) el.innerHTML = `ISS: brak połączenia <span class="offline-badge">offline</span>`;
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

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function fetchNextPassage() {
  try {
    const res = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=2LE');
    const text = await res.text();
    const lines = text.trim().split('\n');
    // 2LE has no name line: lines[0] = TLE line 1, lines[1] = TLE line 2
    const satrec = satellite.twoline2satrec(lines[0].trim(), lines[1].trim());

    const now = new Date();
    for (let i = 0; i < 5760; i++) { // check every 5s for 8h
      const t = new Date(now.getTime() + i * 5000);
      const { position } = satellite.propagate(satrec, t);
      if (!position) continue;
      const gmst = satellite.gstime(t);
      const posGd = satellite.eciToGeodetic(position, gmst);
      const issLat = posGd.latitude  * 180 / Math.PI;
      const issLon = posGd.longitude * 180 / Math.PI;
      if (haversineKm(OBS_LAT, OBS_LON, issLat, issLon) < 300) {
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
  let issData, kp, nextPass, variant;

  if (demoMode) {
    const demo = getDemoData(demoVariant);
    issData = demo.issData;
    kp = demo.kp;
    nextPass = demo.nextPass;
    variant = demoVariant;
  } else {
    [issData, kp, nextPass] = await Promise.all([fetchISS(), fetchKp(), fetchNextPassage()]);
    if (kp !== null && kp >= 4) {
      variant = 'interference';
    } else if (issData && issData.lon >= 0 && issData.lon <= 40
               && issData.lat >= 35 && issData.lat <= 72) {
      variant = 'contact';
    } else {
      variant = 'silence';
    }
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
  const divider = document.getElementById('split-divider');
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

  const update = (val) => {
    before.style.clipPath = `inset(0 ${100 - val}% 0 0)`;
    if (divider) divider.style.left = `${val}%`;
  };

  slider.addEventListener('input', (e) => update(e.target.value));
  update(50);
}

let mapInitialized = false;
let finalRendered = false;

function showView(id) {
  const validViews = ['intro', 'historia', 'map', 'archiwum', 'final'];
  if (!validViews.includes(id)) id = 'intro';

  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));

  const section = document.getElementById(id);
  if (section) section.classList.add('active');

  const link = document.querySelector(`.nav-link[data-view="${id}"]`);
  if (link) link.classList.add('active');

  if (id === 'map' && !mapInitialized) {
    initMap();
    mapInitialized = true;
  }

  if (id === 'final' && !finalRendered) {
    renderFinale();
    finalRendered = true;
  }
}

function router() {
  const hash = window.location.hash.slice(1) || 'intro';
  showView(hash);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('intro-narration').textContent = narration.intro;

  const historiaBodyEl = document.getElementById('historia-body');
  if (historiaBodyEl && narration.historia) {
    historiaBodyEl.textContent = narration.historia;
  }

  initSplitScreen();

  fetchISS();
  setInterval(fetchISS, 5000);

  document.getElementById('btn-share')?.addEventListener('click', () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Hutnik, który patrzył w górę',
        text: 'Twoja wersja historii zależy od stanu kosmosu w tej chwili. Sprawdź swoją.',
        url,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('btn-share');
        if (btn) {
          btn.textContent = 'Link skopiowany ✓';
          setTimeout(() => { btn.textContent = 'Podziel się swoją wersją historii'; }, 2500);
        }
      });
    }
  });

  document.getElementById('btn-demo')?.addEventListener('click', () => {
    demoMode = !demoMode;
    document.getElementById('btn-demo').classList.toggle('active', demoMode);
    finalRendered = false;
    fetchISS();
  });

  window.addEventListener('hashchange', router);
  router();
});
