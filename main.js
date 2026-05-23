let demoMode = false;
const DEMO_VARIANTS = ['contact', 'silence', 'interference'];
const demoVariant = DEMO_VARIANTS[Math.floor(Math.random() * DEMO_VARIANTS.length)];

const spaceState = { issLat: null, issLon: null, kp: null };

function getDemoData(variant) {
  if (variant === 'contact') {
    return { issData: { lat: 50.58, lon: 22.05 }, kp: 1.5, nextPass: 'za 12 min' };
  }
  if (variant === 'interference') {
    return { issData: { lat: 51.12, lon: 23.44 }, kp: 5.3, nextPass: 'za 45 min' };
  }
  return { issData: { lat: -10.22, lon: 135.44 }, kp: 0.7, nextPass: null };
}

function formatCoords(lat, lon) {
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

const CATEGORY_COLOR = { 'historia': '#d4890a' };

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

function getNotatka(m) {
  let issLat, issLon, kp;
  if (demoMode) {
    const demo = getDemoData(demoVariant);
    issLat = demo.issData.lat; issLon = demo.issData.lon; kp = demo.kp;
  } else {
    issLat = spaceState.issLat; issLon = spaceState.issLon; kp = spaceState.kp;
  }
  if (kp !== null && kp >= 4) return m.notatka_minimal;
  if (issLon !== null && issLon >= 0 && issLon <= 40 && issLat !== null && issLat >= 35 && issLat <= 72) {
    return m.notatka_full;
  }
  return m.notatka_more;
}

function openPanel(m) {
  const notatka = getNotatka(m);
  const kp = demoMode ? getDemoData(demoVariant).kp : spaceState.kp;
  const isMinimal = kp !== null && kp >= 4;

  document.getElementById('map-panel').innerHTML = `
    ${m.zdjecie ? `<img src="${m.zdjecie}" class="marker-photo" alt="${m.tytul}" onerror="this.style.display='none'">` : ''}
    <p class="marker-meta">${m.rok_zdjecia || '—'} · ${m.tytul}</p>
    <p class="cytat">"${m.historia}"</p>
    <p class="notatka${isMinimal ? ' notatka-brak' : ''}">${notatka || ''}</p>
  `;
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
    if (el) el.innerHTML = `[DEMO] ISS: ${formatCoords(issData.lat, issData.lon)} — ${locLabel}`;
    return issData;
  }
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const lat = parseFloat(data.latitude.toFixed(2));
    const lon = parseFloat(data.longitude.toFixed(2));

    const el = document.getElementById('iss-status');
    if (el) {
      el.innerHTML = `ISS: ${formatCoords(lat, lon)} — ${issKontekst(lat, lon)}`;
    }

    return { lat, lon };
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
    for (let i = 0; i < 3600; i++) { // check every 1s for 1h
      const t = new Date(now.getTime() + i * 1000);
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
    [nextPass] = await Promise.all([fetchNextPassage()]);
    issData = (spaceState.issLat !== null) ? { lat: spaceState.issLat, lon: spaceState.issLon, alt: null } : null;
    kp = spaceState.kp;
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
    const coords = issData ? formatCoords(issData.lat, issData.lon) : '—';
    const location = issData ? issKontekst(issData.lat, issData.lon) : '—';
    daneEl.innerHTML = `
      <div>ISS pozycja: ${coords} — ${location}</div>
      ${nextPass ? `<div>Przelot nad Stalową Wolą: ${nextPass}</div>` : ''}
      <div>Indeks aktywności słonecznej (Kp): ${kpDisplay}${kp !== null && kp >= 4 ? ' ⚡ burza magnetyczna' : ''}</div>
    `;
  }
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

  async function pollISS() {
    const iss = await fetchISS();
    if (iss) { spaceState.issLat = iss.lat; spaceState.issLon = iss.lon; }
  }
  pollISS().then(() => setInterval(pollISS, 1000));
  fetchKp().then(kp => { if (kp !== null) spaceState.kp = kp; });

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
