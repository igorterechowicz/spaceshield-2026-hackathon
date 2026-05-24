let demoMode = false;
const DEMO_VARIANTS = ['contact', 'silence', 'interference'];
let demoVariant = 'contact';

const spaceState = { issLat: null, issLon: null, kp: null, nextPass: null };

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

function buildShareHash(variant, kp, issData) {
  const label = narration.share.variant_labels[variant] || variant;
  const kpStr = kp !== null ? kp.toFixed(1) : '—';
  const issStr = issData ? formatCoords(issData.lat, issData.lon) : '—';
  const dateStr = new Date().toLocaleDateString('pl-PL', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
  return `${label} · Kp ${kpStr} · ISS ${issStr} · ${dateStr}`;
}

const SHARE_BG = {
  contact: 'assets/img/finale-contact.png',
  silence: 'assets/img/finale-silence.png',
  interference: 'assets/img/finale-interference.jpg'
};

function populateShareCard(variant, kp, issData, nextPass) {
  const finaleKey = `finale_${variant}`;
  const kpDisplay = kp !== null ? kp.toFixed(1) : '—';
  const tekst = (narration[finaleKey] || '')
    .replace('[KP_VALUE]', kpDisplay)
    .replace('[NEXT_PASS]', nextPass ?? '—');

  const bgEl = document.getElementById('share-card-bg');
  if (bgEl) bgEl.style.backgroundImage = `url('${SHARE_BG[variant]}')`;

  document.getElementById('share-variant-label').textContent =
    narration.share.variant_labels[variant] || '';
  document.getElementById('share-finale-text').textContent = tekst;
  document.getElementById('share-space-data').innerHTML =
    `<span class="share-label">ISS</span>${issData ? formatCoords(issData.lat, issData.lon) : '—'}&emsp;&emsp;<span class="share-label">Kp</span>${kpDisplay}`;
  document.getElementById('share-hash').textContent =
    buildShareHash(variant, kp, issData);
}

const CATEGORY_COLOR = { 'historia': '#d4890a' };

function formatISSLabel(issData) {
  const coords = issData ? formatCoords(issData.lat, issData.lon) : '—';
  const location = issData ? issKontekst(issData.lat, issData.lon) : '—';
  return `ISS pozycja: ${coords} — ${location}`;
}

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

  map = L.map('leaflet-map', {
    maxBounds: stalowaBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 12,
  }).setView([50.5833, 22.0500], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CartoDB'
  }).addTo(map);

  markers.forEach(m => {
    const layer = L.marker([m.lat, m.lon], { icon: createIcon(m.kategoria) });
    layer.on('click', () => openPanel(m));
    if (!m.order || m.order <= 1) {
      layer.addTo(map);
    } else {
      markerLayerByOrder[m.order] = layer;
    }
  });

  return map;
}

function revealNextMarker() {
  revealedUpTo += 1;
  const layer = markerLayerByOrder[revealedUpTo];
  if (layer) {
    layer.addTo(map);
    const el = layer.getElement();
    if (el) {
      el.classList.add('marker-popin');
      el.addEventListener('animationend', () => el.classList.remove('marker-popin'), { once: true });
    }
  }
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
  window._lastOpenedMarker = m;
  const notatka = getNotatka(m);
  const kp = demoMode ? getDemoData(demoVariant).kp : spaceState.kp;
  const isMinimal = kp !== null && kp >= 4;

  document.getElementById('map-panel').innerHTML = `
    ${m.zdjecie ? `<img src="${m.zdjecie}" class="marker-photo" alt="${m.tytul}" onerror="this.style.display='none'">` : ''}
    <p class="marker-meta">${m.rok_zdjecia || '—'} · ${m.tytul}</p>
    <p class="cytat">${m.historia}</p>
    <p class="notatka${isMinimal ? ' notatka-brak' : ''}"${isMinimal ? ' data-glitch-target' : ''}>"${notatka || ''}"</p>
  `;

  clearTimeout(revealTimer);
  if (m.order && markerLayerByOrder[m.order + 1]) {
    revealTimer = setTimeout(revealNextMarker, 10_000);
  }
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
    const el = document.getElementById('iss-status');
    if (el) el.innerHTML = `[DEMO] ${formatISSLabel(issData)}`;
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
      el.innerHTML = formatISSLabel({ lat, lon });
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
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544/tles');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const satrec = satellite.twoline2satrec(data.line1.trim(), data.line2.trim());

    const now = new Date();

    // Phase 1: coarse scan every 60s for 24h (1440 steps)
    let coarseHitMs = null;
    for (let i = 0; i < 1440; i++) {
      const ms = i * 60000;
      const t = new Date(now.getTime() + ms);
      const { position } = satellite.propagate(satrec, t);
      if (!position) continue;
      const gmst = satellite.gstime(t);
      const posGd = satellite.eciToGeodetic(position, gmst);
      const issLat = posGd.latitude  * 180 / Math.PI;
      const issLon = posGd.longitude * 180 / Math.PI;
      if (haversineKm(OBS_LAT, OBS_LON, issLat, issLon) < 300) {
        coarseHitMs = ms;
        break;
      }
    }

    if (coarseHitMs === null) return null;

    // Phase 2: refine ±5 min around coarse hit (≤600 steps of 1s)
    const refineStart = Math.max(0, coarseHitMs - 5 * 60000);
    const refineEnd = coarseHitMs + 5 * 60000;
    for (let ms = refineStart; ms <= refineEnd; ms += 1000) {
      const t = new Date(now.getTime() + ms);
      const { position } = satellite.propagate(satrec, t);
      if (!position) continue;
      const gmst = satellite.gstime(t);
      const posGd = satellite.eciToGeodetic(position, gmst);
      const issLat = posGd.latitude  * 180 / Math.PI;
      const issLon = posGd.longitude * 180 / Math.PI;
      if (haversineKm(OBS_LAT, OBS_LON, issLat, issLon) < 300) {
        const mins = Math.round(ms / 60000);
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
    nextPass = spaceState.nextPass;
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

  const finalEl = document.getElementById('final');
  finalEl.classList.remove('finale-contact', 'finale-silence', 'finale-interference');
  finalEl.classList.add(`finale-${variant}`);

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
    daneEl.innerHTML = `
      <div>${formatISSLabel(issData)}</div>
      ${nextPass ? `<div>Przelot nad Stalową Wolą: ${nextPass}</div>` : ''}
      <div>Indeks aktywności słonecznej (Kp): ${kpDisplay}${kp !== null && kp >= 4 ? ' ⚡ burza magnetyczna' : ''}</div>
    `;
  }

  if (variant === 'interference') {
    startGlitch();
  } else {
    stopGlitch();
  }
}


let mapInitialized = false;
let finalRendered = false;
let map = null;
let revealedUpTo = 1;
let revealTimer = null;
const markerLayerByOrder = {};

const GLITCH_CHARS = ['▓', '░', '▒', '╗', '╔', '╝', '╚', '█', '▄', '▀', '⁂', '‽', '×', '⚡'];
let glitchTimeout = null;
let interferenceActive = false;

function startGlitch() {
  interferenceActive = true;
  if (glitchTimeout) return;
  scheduleNextTick();
}

function stopGlitch() {
  interferenceActive = false;
  if (glitchTimeout) {
    clearTimeout(glitchTimeout);
    glitchTimeout = null;
  }
  document.querySelectorAll('.glitch-char').forEach(span => {
    if (span.parentNode) {
      span.parentNode.insertBefore(document.createTextNode(span.dataset.original || ''), span);
      span.parentNode.removeChild(span);
    }
  });
}

function scheduleNextTick() {
  glitchTimeout = setTimeout(() => {
    glitchTimeout = null;
    runGlitchTick();
    if (interferenceActive) {
      scheduleNextTick();
    }
  }, 350 + Math.random() * 200);
}

function runGlitchTick() {
  if (!interferenceActive) return;

  const targets = [...document.querySelectorAll(
    '#intro-narration, #iss-status, #historia-body, ' +
    '#finale-text, .space-data, .cytat, .notatka, .marker-meta, [data-glitch-target]'
  )];
  const charNodes = collectGlitchableChars(targets);
  if (charNodes.length === 0) return;

  const count = 2 + Math.floor(Math.random() * 3);
  pickRandom(charNodes, count).forEach(({ node, index }) => injectGlitchChar(node, index));
}

function collectGlitchableChars(targets) {
  const result = [];
  targets.forEach(target => {
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('.glitch-char, a, button, [data-no-glitch]')) continue;
      const text = node.textContent;
      for (let i = 0; i < text.length; i++) {
        if (/\S/.test(text[i])) result.push({ node, index: i });
      }
    }
  });
  return result;
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  const seen = new Set();
  const result = [];
  for (const item of shuffled) {
    if (seen.has(item.node)) continue;
    seen.add(item.node);
    result.push(item);
    if (result.length >= count) break;
  }
  return result;
}

function injectGlitchChar(node, charIndex) {
  if (!node.parentNode) return;
  const text = node.textContent;
  if (charIndex >= text.length) return;

  const before = text.slice(0, charIndex);
  const original = text[charIndex];
  const after = text.slice(charIndex + 1);

  const noiseChar = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
  const span = document.createElement('span');
  span.className = 'glitch-char';
  span.dataset.original = original;
  span.textContent = noiseChar;

  const parent = node.parentNode;
  if (before) parent.insertBefore(document.createTextNode(before), node);
  parent.insertBefore(span, node);
  if (after) parent.insertBefore(document.createTextNode(after), node);
  parent.removeChild(node);

  setTimeout(() => {
    if (!span.parentNode) return;
    span.parentNode.insertBefore(document.createTextNode(original), span);
    span.parentNode.removeChild(span);
  }, 80 + Math.random() * 60);
}

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
  pollISS();
  fetchKp().then(kp => {
    if (kp !== null) {
      spaceState.kp = kp;
      if (!demoMode && kp >= 4) startGlitch();
    }
  });
  fetchNextPassage().then(p => { spaceState.nextPass = p; });

  document.getElementById('btn-share')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-share');
    btn.textContent = 'Generowanie karty…';
    btn.disabled = true;

    let variant, kp, issData, nextPass;
    if (demoMode) {
      const demo = getDemoData(demoVariant);
      variant = demoVariant; kp = demo.kp; issData = demo.issData; nextPass = demo.nextPass;
    } else {
      nextPass = spaceState.nextPass;
      issData = spaceState.issLat !== null ? { lat: spaceState.issLat, lon: spaceState.issLon } : null;
      kp = spaceState.kp;
      if (kp !== null && kp >= 4) variant = 'interference';
      else if (issData && issData.lon >= 0 && issData.lon <= 40 && issData.lat >= 35 && issData.lat <= 72) variant = 'contact';
      else variant = 'silence';
    }

    populateShareCard(variant, kp, issData, nextPass);

    if (!window.html2canvas) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    const card = document.getElementById('share-card');
    const canvas = await window.html2canvas(card, {
      width: 800, height: 480, scale: 2, useCORS: true,
      backgroundColor: '#0a0a0f'
    });

    const dateTag = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.download = `hutnik-${variant}-${dateTag}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    btn.textContent = 'Podziel się swoją wersją historii';
    btn.disabled = false;
  });

  document.getElementById('btn-demo')?.addEventListener('click', async () => {
    demoMode = !demoMode;
    const btn = document.getElementById('btn-demo');
    btn.classList.toggle('active', demoMode);

    const variantBtns = document.getElementById('demo-variant-btns');
    variantBtns.style.display = demoMode ? 'grid' : 'none';

    const iss = await fetchISS();
    if (!demoMode && iss) {
      spaceState.issLat = iss.lat;
      spaceState.issLon = iss.lon;
    }

    if (finalRendered) {
      renderFinale();
    } else {
      finalRendered = false;
      if (demoMode && demoVariant === 'interference') startGlitch();
      else if (!demoMode && spaceState.kp !== null && spaceState.kp >= 4) startGlitch();
      else stopGlitch();
    }
  });

  document.querySelectorAll('.btn-variant').forEach(btn => {
    btn.addEventListener('click', () => {
      demoVariant = btn.dataset.variant;

      document.querySelectorAll('.btn-variant').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      fetchISS();

      if (finalRendered) {
        finalRendered = false;
        renderFinale();
        finalRendered = true;
      } else {
        if (demoVariant === 'interference') startGlitch();
        else stopGlitch();
      }

      if (window._lastOpenedMarker) openPanel(window._lastOpenedMarker);
    });
  });

  window.addEventListener('hashchange', router);
  router();
});
