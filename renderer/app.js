/* Air Caraïbe Virtual — ACARS bêta (interface) */
(function () {
  'use strict';

  const DISCORD_URL = 'https://discord.gg/FtHDwjt9C9';
  const $ = (id) => document.getElementById(id);

  // ---------- Stockage local (sur cet ordinateur) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('acv.' + key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('acv.' + key, JSON.stringify(value)); } catch (e) { /* plein ou bloqué */ }
    }
  };

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 4000);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Réseau de la compagnie ----------
  const AIRPORTS = {
    TFFR: ['Pointe-à-Pitre', 16.2653, -61.5318],
    TFFF: ['Fort-de-France', 14.5910, -61.0032],
    TFFJ: ['Saint-Barthélemy', 17.9044, -62.8436],
    TNCM: ['Saint-Martin (Juliana)', 18.0410, -63.1089],
    TFFG: ['Saint-Martin (Grand-Case)', 18.0999, -63.0472],
    TFFM: ['Marie-Galante', 15.8687, -61.2700],
    TDPD: ['Dominique', 15.5470, -61.3000],
    TAPA: ['Antigua', 17.1367, -61.7926],
    TBPB: ['Barbade', 13.0746, -59.4925],
    SOCA: ['Cayenne', 4.8198, -52.3604],
    MDPC: ['Punta Cana', 18.5674, -68.3634],
    LFPO: ['Paris-Orly', 48.7233, 2.3794]
  };
  const ROUTES = [
    ['TFFR','TFFF','iles'],['TFFR','TFFJ','iles'],['TFFR','TNCM','iles'],['TFFR','TFFM','iles'],
    ['TFFR','TFFG','iles'],['TFFF','TFFJ','iles'],['TNCM','TFFJ','iles'],['TFFR','TDPD','iles'],
    ['TFFR','TAPA','iles'],['TFFF','TDPD','iles'],
    ['TFFF','TBPB','carib'],['TFFR','SOCA','carib'],['TFFF','SOCA','carib'],['TFFR','MDPC','carib'],['TFFF','MDPC','carib'],
    ['TFFR','LFPO','transat'],['TFFF','LFPO','transat'],['SOCA','LFPO','transat']
  ];
  const SIMBRIEF_TYPES = { 'DHC-6 Twin Otter': 'DHC6', 'ATR 72-600': 'AT76', 'Airbus A320neo': 'A20N', 'Airbus A350-900': 'A359' };
  function simbriefUrl(f) {
    const q = new URLSearchParams({
      airline: 'ACX', fltnum: String(f.num).replace(/\D/g, ''), type: SIMBRIEF_TYPES[f.aircraft] || '',
      orig: f.from, dest: f.to, deph: (f.dep || '').slice(0, 2), depm: (f.dep || '').slice(3, 5),
      steh: String(Math.floor(f.mins / 60)), stem: String(f.mins % 60)
    });
    return 'https://dispatch.simbrief.com/options/custom?' + q.toString();
  }
  function openUrl(url) { if (window.acv) window.acv.openExternal(url); else window.open(url, '_blank'); }
  const CAT_LABELS = { all: 'Tous', iles: 'Inter-îles', carib: 'Caraïbes', transat: 'Transatlantique' };

  function distanceNm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 3440.065 * Math.asin(Math.sqrt(h));
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDur = (mins) => Math.floor(mins / 60) + ' h ' + pad2(Math.round(mins % 60));

  // Avion attribué à une ligne : Twin Otter pour Saint-Barth (piste courte), ATR pour les courtes
  // distances, A320neo pour les Caraïbes, A350 pour la transatlantique.
  function planeFor(from, to, cat, nm) {
    if (from === 'TFFJ' || to === 'TFFJ') return { aircraft: 'DHC-6 Twin Otter', speed: 150 };
    if (cat === 'transat') return { aircraft: 'Airbus A350-900', speed: 480 };
    if (nm < 350) return { aircraft: 'ATR 72-600', speed: 270 };
    return { aircraft: 'Airbus A320neo', speed: 450 };
  }
  // Toutes les lignes, dans les deux sens, avec leur avion
  const LEGS = [];
  ROUTES.forEach(([x, y, c]) => {
    [[x, y], [y, x]].forEach(([from, to]) => {
      const a = AIRPORTS[from], b = AIRPORTS[to];
      const nm = Math.round(distanceNm(a[1], a[2], b[1], b[2]));
      const p = planeFor(from, to, c, nm);
      LEGS.push({ from, to, cat: c, nm, aircraft: p.aircraft, mins: Math.round(nm / p.speed * 60 + 20) });
    });
  });
  function legsFor(cat, plane) {
    return LEGS.filter((l) => (cat === 'all' || l.cat === cat) && (plane === 'all' || l.aircraft === plane));
  }
  function flightFromLeg(l) {
    const d = new Date(Date.now() + (30 + Math.floor(Math.random() * 43) * 5) * 60000);
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    return Object.assign({}, l, {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      num: 'ACX ' + (100 + Math.floor(Math.random() * 900)),
      dep: pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    });
  }
  function makeFlight(cat, prev, plane) {
    const pool = legsFor(cat, plane || 'all');
    if (!pool.length) return null;
    let l, tries = 0;
    do { l = pool[Math.floor(Math.random() * pool.length)]; tries++; }
    while (prev && pool.length > 1 && prev.from === l.from && prev.to === l.to && tries < 10);
    return flightFromLeg(l);
  }

  // ---------- Navigation ----------
  let currentView = 'carte';
  let map = null;
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  function showView(name) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    currentView = name;
    if (typeof helperOnView === 'function') helperOnView(name);
    if (name === 'carte' && map) setTimeout(() => map.invalidateSize(), 50);
    if (name === 'mesvols') renderBookings();
    if (name === 'pireps') renderPireps();
    if (name === 'classement') renderBoard();
    if (name === 'vols') renderDaily();
  }

  // ---------- Carte (plan / satellite) ----------
  let planLayer, satLayer, planeMarker = null, trail = null, routeLine = null;
  const aptMarkers = {};
  function updateAirportTips() {
    Object.entries(aptMarkers).forEach(([code, mk]) => {
      const m = wxCache[code];
      mk.setTooltipContent(code + ' · ' + AIRPORTS[code][0] + (m ? '<br><span style="font-weight:600">' + wxShort(m) + '</span>' : ''));
    });
  }
  function initMap() {
    if (typeof L === 'undefined') {
      $('map').innerHTML = '<div class="empty" style="padding:20px">La carte n\'a pas pu se charger.</div>';
      return;
    }
    map = L.map('map', { zoomControl: true, attributionControl: true }).setView([16.4, -61.6], 7);
    // Fonds de carte Esri : gratuits et sans clé (le plan CARTO exige désormais une clé)
    planLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Carte &copy; Esri, HERE, Garmin, OpenStreetMap'
    }).addTo(map);
    satLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18, attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics'
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
    ]);
    Object.entries(AIRPORTS).forEach(([code, a]) => {
      aptMarkers[code] = L.circleMarker([a[1], a[2]], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#8f1238', fillOpacity: 1 })
        .addTo(map)
        .bindTooltip(code + ' · ' + a[0], { direction: 'top', className: 'apt-label', offset: [0, -6] });
    });
    trail = L.polyline([], { color: '#d6204f', weight: 3, opacity: 0.85 }).addTo(map);
  }
  function setMapMode(sat) {
    if (!map) return;
    if (sat) { map.removeLayer(planLayer); satLayer.addTo(map); }
    else { map.removeLayer(satLayer); planLayer.addTo(map); }
    $('btnPlan').classList.toggle('active', !sat);
    $('btnSat').classList.toggle('active', sat);
    store.set('mapSat', sat);
  }
  $('btnPlan').addEventListener('click', () => setMapMode(false));
  $('btnSat').addEventListener('click', () => setMapMode(true));
  $('btnClearTrail').addEventListener('click', () => { if (trail) trail.setLatLngs([]); });

  // ---------- Météo sur la carte : radar de pluie et nuages par satellite ----------
  let radarLayer = null, cloudLayer = null, radarTime = 0;
  function wxLayerLabel() {
    const parts = [];
    if ($('wxRadar').checked && radarTime) { const d = new Date(radarTime * 1000); parts.push('<span class="radar-legend">Radar ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ' <i title="faible à très forte"></i></span>'); }
    if ($('wxClouds').checked) parts.push('Nuages : image satellite GOES (toutes les 10 min)');
    $('wxLayerTime').innerHTML = parts.join(' · ');
  }
  function loadRadar() {
    if (!map || !$('wxRadar').checked || !window.acv || !window.acv.radar) return;
    window.acv.radar().then((r) => {
      if (!r || !r.ok) { toast('Radar météo indisponible pour le moment'); return; }
      radarTime = r.time;
      if (radarLayer) map.removeLayer(radarLayer);
      radarLayer = L.tileLayer(r.url, { opacity: 0.7, maxNativeZoom: 7, maxZoom: 18, zIndex: 400, attribution: 'Radar &copy; RainViewer' }).addTo(map);
      wxLayerLabel();
    }).catch(() => toast('Radar météo indisponible pour le moment'));
  }
  function setClouds(on) {
    if (!map) return;
    if (on && !cloudLayer) {
      cloudLayer = L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_Band13_Clean_Infrared/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png', {
        opacity: 0.45, maxNativeZoom: 6, maxZoom: 18, zIndex: 350, attribution: 'Nuages &copy; NASA GIBS, NOAA GOES'
      }).addTo(map);
    } else if (!on && cloudLayer) { map.removeLayer(cloudLayer); cloudLayer = null; }
  }
  $('wxRadar').addEventListener('change', (e) => {
    store.set('wxRadar', e.target.checked);
    if (e.target.checked) loadRadar(); else if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
    wxLayerLabel();
  });
  $('wxClouds').addEventListener('change', (e) => { store.set('wxClouds', e.target.checked); setClouds(e.target.checked); wxLayerLabel(); });
  setInterval(() => { loadRadar(); if (cloudLayer) cloudLayer.redraw(); }, 10 * 60 * 1000);

  const PLANE_SVG = '<svg width="34" height="34" viewBox="-17 -17 34 34" style="display:block;transform-origin:center"><path d="M0 -16 C 2 -16 3 -12 3 -8 L3 -3 L16 4 L16 7 L3 4 L2 11 L6 14 L6 16 L0 15 L-6 16 L-6 14 L-2 11 L-3 4 L-16 7 L-16 4 L-3 -3 L-3 -8 C -3 -12 -2 -16 0 -16 Z" fill="#d6204f" stroke="#ffffff" stroke-width="1.6"/></svg>';
  function updatePlane(d) {
    if (!map) return;
    const ll = [d.lat, d.lon];
    if (!planeMarker) {
      planeMarker = L.marker(ll, {
        icon: L.divIcon({ className: 'plane-icon', html: PLANE_SVG, iconSize: [34, 34], iconAnchor: [17, 17] }),
        zIndexOffset: 1000
      }).addTo(map);
    } else {
      planeMarker.setLatLng(ll);
    }
    const el = planeMarker.getElement();
    if (el) { const svg = el.querySelector('svg'); if (svg) svg.style.transform = 'rotate(' + d.hdg + 'deg)'; }
    if (!d.onGround || d.gs > 3) {
      trail.addLatLng(ll);
      const pts = trail.getLatLngs();
      if (pts.length > 4000) trail.setLatLngs(pts.slice(-3000));
    }
    if ($('followPlane').checked) map.panTo(ll, { animate: true });
  }
  // ---------- Route et TOD (point de début de descente) ----------
  // Altitude de croisière par défaut quand il n'y a pas de plan SimBrief
  const DEFAULT_CRUISE = { 'DHC-6 Twin Otter': 8000, 'ATR 72-600': 17000, 'Airbus A320neo': 36000, 'Airbus A350-900': 38000 };
  let todMarker = null;
  let todKey = '';

  function routePath(flight) {
    if (flight.ofp && flight.ofp.fixes && flight.ofp.fixes.length > 1) return flight.ofp.fixes.map((f) => [f.lat, f.lon]);
    const a = AIRPORTS[flight.from], b = AIRPORTS[flight.to];
    return [[a[1], a[2]], [b[1], b[2]]];
  }
  function cruiseFeet(flight) {
    const fl = flight.ofp && /FL(\d+)/.exec(flight.ofp.cruise || '');
    if (fl) return Number(fl[1]) * 100;
    if (flight.state === 'airborne' && flight.maxAlt > 3000) return flight.maxAlt;
    return DEFAULT_CRUISE[flight.aircraft] || 30000;
  }
  // Distance du TOD avant l'arrivée : règle des 3 NM par tranche de 1 000 ft à perdre
  function todDistance(flight) { return Math.round(cruiseFeet(flight) / 1000 * 3); }
  // Position du TOD : celui du plan SimBrief s'il existe, sinon calculé sur la route en partant de l'arrivée
  function todPoint(flight) {
    const ofpTod = flight.ofp && flight.ofp.fixes && flight.ofp.fixes.find((f) => f.id === 'TOD');
    if (ofpTod) return { lat: ofpTod.lat, lon: ofpTod.lon, fromPlan: true };
    const path = routePath(flight);
    let left = todDistance(flight);
    for (let i = path.length - 1; i > 0; i--) {
      const [la2, lo2] = path[i], [la1, lo1] = path[i - 1];
      const seg = distanceNm(la1, lo1, la2, lo2);
      if (seg >= left) {
        const t = seg ? left / seg : 0;
        return { lat: la2 + (la1 - la2) * t, lon: lo2 + (lo1 - lo2) * t, fromPlan: false };
      }
      left -= seg;
    }
    return { lat: path[0][0], lon: path[0][1], fromPlan: false };
  }
  function drawTod(flight) {
    if (!map) return;
    const key = flight ? flight.id + '|' + cruiseFeet(flight) + '|' + (flight.ofp ? flight.ofp.route : '') : '';
    if (key === todKey) return;
    todKey = key;
    if (todMarker) { map.removeLayer(todMarker); todMarker = null; }
    if (!flight) return;
    const p = todPoint(flight);
    todMarker = L.marker([p.lat, p.lon], {
      icon: L.divIcon({ className: 'tod-icon', html: '<span>TOD</span>', iconSize: [46, 24], iconAnchor: [23, 12] }),
      zIndexOffset: 500
    }).addTo(map).bindTooltip('Début de descente' + (p.fromPlan ? ' (plan SimBrief)' : ' · environ ' + todDistance(flight) + ' NM avant ' + flight.to), { direction: 'top', offset: [0, -10] });
  }
  function drawRoute(flight) {
    if (!map) return;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    todKey = '';
    drawTod(flight);
    if (!flight) return;
    const ofp = flight.ofp && flight.ofp.fixes && flight.ofp.fixes.length > 1;
    routeLine = L.polyline(routePath(flight), { color: '#2b1a22', weight: ofp ? 2.5 : 2, dashArray: ofp ? '6 6' : '8 8' }).addTo(map);
  }

  // ---------- Où j'en suis dans mon vol ----------
  function routeLength(path) {
    let t = 0;
    for (let i = 1; i < path.length; i++) t += distanceNm(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
    return t;
  }
  // ---------- Profil vertical (altitude selon la distance parcourue) ----------
  let profTimer = 0;
  function recordProfile(a, d) {
    if (!a || a.state !== 'airborne') return;
    a.prof = a.prof || [];
    const last = a.prof[a.prof.length - 1];
    const step = last ? distanceNm(last.lat, last.lon, d.lat, d.lon) : 0;
    const dist = last ? last.d + step : 0;
    if (!last || step >= 0.8 || Math.abs(d.alt - last.alt) >= 250 || d.t - last.t > 20000) {
      a.prof.push({ d: Math.round(dist * 10) / 10, alt: Math.round(d.alt), vs: Math.round(d.vs), lat: d.lat, lon: d.lon, t: d.t });
      if (a.prof.length > 1500) a.prof = a.prof.filter((_, i) => i % 2 === 0);
      store.set('active', a);
    }
  }
  function niceStep(maxFt) {
    const steps = [1000, 2000, 5000, 10000, 20000];
    return steps.find((st) => Math.ceil(maxFt / st) <= 5) || 20000;
  }
  function phaseColor(p, nextAlt) {
    if (p.vs > 300) return '#1f9d63';
    if (p.vs < -300) return p.alt < 4000 ? '#d6204f' : '#e8890c';
    return '#3b6fd8';
  }
  function renderProfile(a, d) {
    const card = $('profileCard');
    const pts = (a && a.prof) || [];
    if (!a || pts.length < 2) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const W = 760, H = 170, L = 52, R = 18, T = 14, B = 26;
    const total = Math.max(routeLength(routePath(a)), pts[pts.length - 1].d, 1);
    const maxNm = Math.ceil(total / 50) * 50 || 50;
    const top = Math.max(cruiseFeet(a), ...pts.map((p) => p.alt)) * 1.08;
    const stepFt = niceStep(top);
    const maxFt = Math.ceil(top / stepFt) * stepFt;
    const x = (nm) => L + (nm / maxNm) * (W - L - R);
    const y = (ft) => T + (1 - Math.max(0, ft) / maxFt) * (H - T - B);
    let g = '';
    for (let ft = 0; ft <= maxFt; ft += stepFt) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(ft) + '" y2="' + y(ft) + '" stroke="#f1e6e9"/>' +
        '<text class="ax" x="' + (L - 8) + '" y="' + (y(ft) + 4) + '" text-anchor="end">' + (ft === 0 ? '0' : stepFt >= 5000 ? 'FL' + String(ft / 100).padStart(3, '0') : (ft / 1000) + 'k ft') + '</text>';
    }
    const nmStep = [10, 20, 50, 100, 200, 500, 1000].find((st) => maxNm / st <= 8) || 1000;
    for (let nm = 0; nm <= maxNm; nm += nmStep) {
      if (x(nm) > W - R - 34) continue;  // laisse la place au libellé NM
      g += '<text class="ax" x="' + x(nm) + '" y="' + (H - 8) + '" text-anchor="middle">' + nm + '</text>';
    }
    g += '<text class="ax" x="' + (W - R) + '" y="' + (H - 8) + '" text-anchor="end" font-weight="700">NM</text>';
    // TOD prévu
    const todNm = Math.max(0, total - todDistance(a));
    g += '<line x1="' + x(todNm) + '" x2="' + x(todNm) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#2b1a22" stroke-dasharray="4 4" opacity="0.5"/>' +
      '<text class="ax" x="' + (x(todNm) + 4) + '" y="' + (T + 10) + '" font-weight="700">TOD</text>';
    // zone remplie sous la trace
    const area = 'M' + x(pts[0].d) + ',' + y(0) + ' ' + pts.map((p) => 'L' + x(p.d).toFixed(1) + ',' + y(p.alt).toFixed(1)).join(' ') + ' L' + x(pts[pts.length - 1].d) + ',' + y(0) + ' Z';
    g += '<path d="' + area + '" fill="#d6204f" opacity="0.07"/>';
    // trace colorée par phase
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1], p1 = pts[i];
      g += '<line x1="' + x(p0.d).toFixed(1) + '" y1="' + y(p0.alt).toFixed(1) + '" x2="' + x(p1.d).toFixed(1) + '" y2="' + y(p1.alt).toFixed(1) + '" stroke="' + phaseColor(p1) + '" stroke-width="3" stroke-linecap="round"/>';
    }
    const last = pts[pts.length - 1];
    const cur = d && d.alt != null ? d.alt : last.alt;
    const lx = x(last.d), ly = y(cur);
    const label = (cur >= 18000 ? 'FL' + String(Math.round(cur / 100)).padStart(3, '0') : Math.round(cur).toLocaleString('fr-FR') + ' ft');
    const anchor = lx > W - 110 ? 'end' : 'start';
    g += '<circle cx="' + lx + '" cy="' + ly + '" r="6" fill="#ffd23f" stroke="#2b1a22" stroke-width="2"/>' +
      '<rect x="' + (anchor === 'end' ? lx - 84 : lx + 10) + '" y="' + (ly - 26) + '" width="74" height="20" rx="6" fill="#2b1a22"/>' +
      '<text x="' + (anchor === 'end' ? lx - 47 : lx + 47) + '" y="' + (ly - 12) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff" font-family="Segoe UI, system-ui, sans-serif">' + label + '</text>';
    $('profileChart').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Profil vertical du vol : ' + label + ' à ' + Math.round(last.d) + ' NM du départ">' + g + '</svg>';
  }

  function updateProgress(d) {
    const a = getActive();
    const box = $('progressBox');
    if (!a || !box) return;
    const arr = AIRPORTS[a.to];
    const total = Math.max(1, routeLength(routePath(a)));
    const remaining = distanceNm(d.lat, d.lon, arr[1], arr[2]);
    const pct = Math.max(0, Math.min(100, Math.round((1 - remaining / total) * 100)));
    const tod = todPoint(a);
    const toTod = distanceNm(d.lat, d.lon, tod.lat, tod.lon);
    const pastTod = remaining <= todDistance(a) + 2 || (tod.fromPlan && remaining < distanceNm(tod.lat, tod.lon, arr[1], arr[2]));
    const gs = Math.max(d.gs, 1);
    const eta = new Date(Date.now() + remaining / gs * 3600000);
    let todText;
    if (d.onGround && a.state !== 'airborne') todText = 'Au sol';
    else if (pastTod) todText = 'TOD passé, en descente';
    else todText = Math.round(toTod) + ' NM · ' + fmtDur(Math.round(toTod / gs * 60));
    box.innerHTML =
      '<div class="prog-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pct + '%"></div></div>' +
      '<div class="prog-grid">' +
      '<div><span>Avancement</span><b>' + pct + ' %</b></div>' +
      '<div><span>Reste</span><b>' + Math.round(remaining) + ' NM</b></div>' +
      '<div><span>TOD dans</span><b>' + todText + '</b></div>' +
      '<div><span>Arrivée estimée</span><b>' + (d.gs > 40 ? pad2(eta.getHours()) + ':' + pad2(eta.getMinutes()) : '—') + '</b></div>' +
      '</div>';
    drawTod(a);
    recordProfile(a, d);
    if (Date.now() - profTimer > 2000) { profTimer = Date.now(); renderProfile(getActive(), d); }
  }

  // ---------- Avions des autres pilotes en vol ----------
  const OTHER_SVG = '<svg width="30" height="30" viewBox="-17 -17 34 34" style="display:block;transform-origin:center"><path d="M0 -16 C 2 -16 3 -12 3 -8 L3 -3 L16 4 L16 7 L3 4 L2 11 L6 14 L6 16 L0 15 L-6 16 L-6 14 L-2 11 L-3 4 L-16 7 L-16 4 L-3 -3 L-3 -8 C -3 -12 -2 -16 0 -16 Z" fill="#0e8a9a" stroke="#ffffff" stroke-width="1.6"/></svg>';
  const others = {};
  let myLast = null;       // dernière donnée du simulateur
  let wasSharing = false;  // j'envoyais ma position
  function pilotId() {
    let id = store.get('pilotId', null);
    if (!id) { id = 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); store.set('pilotId', id); }
    return id;
  }
  function drawOthers(list) {
    if (!map || !Array.isArray(list)) return;
    const me = pilotId();
    const seen = {};
    list.filter((p) => p.id !== me).forEach((p) => {
      seen[p.id] = true;
      const fl = p.alt >= 18000 ? 'FL' + String(Math.round(p.alt / 100)).padStart(3, '0') : Math.round(p.alt).toLocaleString('fr-FR') + ' ft';
      const tip = '<div class="other-tip"><b>' + esc(p.pilot) + (p.callsign ? ' · ' + esc(p.callsign) : '') + '</b><br>' +
        esc(p.num || 'Vol libre') + (p.route ? ' · ' + esc(p.route) : '') + '<br>' + esc(p.aircraft || '') +
        '<br>' + fl + ' · ' + Math.round(p.gs) + ' kt' + (p.phase ? ' · ' + esc(p.phase) : '') + '</div>';
      if (!others[p.id]) {
        others[p.id] = L.marker([p.lat, p.lon], {
          icon: L.divIcon({ className: 'other-plane', html: OTHER_SVG, iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 800
        }).addTo(map).bindTooltip(tip, { direction: 'top', offset: [0, -12] });
      } else {
        others[p.id].setLatLng([p.lat, p.lon]).setTooltipContent(tip);
      }
      const el = others[p.id].getElement();
      if (el) { const svg = el.querySelector('svg'); if (svg) svg.style.transform = 'rotate(' + p.hdg + 'deg)'; }
    });
    Object.keys(others).forEach((id) => { if (!seen[id]) { map.removeLayer(others[id]); delete others[id]; } });
    const n = Object.keys(others).length;
    $('liveCount').textContent = n === 0 ? 'Aucun autre pilote en vol pour le moment' : n === 1 ? '1 autre pilote en vol' : n + ' autres pilotes en vol';
  }
  function liveTick() {
    if (!window.acv || !window.acv.livePost) return;
    const fresh = myLast && Date.now() - myLast.t < 10000;
    const flying = fresh && (!myLast.onGround || myLast.gs > 3);
    if (flying) {
      const id = pilotIdentity(), a = getActive();
      wasSharing = true;
      window.acv.livePost({
        pid: pilotId(), lat: myLast.lat, lon: myLast.lon, alt: Math.round(myLast.alt), gs: Math.round(myLast.gs), hdg: Math.round(myLast.hdg) % 360,
        pilot: id.pilot, callsign: id.callsign, num: a ? a.num : '', route: a ? a.from + ' → ' + a.to : '',
        aircraft: a ? a.aircraft : (myLast.title || ''), phase: phaseOf(myLast)
      }).then((r) => { if (r && r.ok) drawOthers(r.live); }).catch(() => {});
      return;
    }
    if (wasSharing) {  // posé ou simulateur fermé : je disparais de la carte des autres
      wasSharing = false;
      window.acv.livePost({ pid: pilotId(), lat: 0, lon: 0, gone: true }).catch(() => {});
    }
    if (currentView === 'carte') window.acv.liveList().then((r) => { if (r && r.ok) drawOthers(r.live); }).catch(() => {});
  }
  setInterval(liveTick, 20000);
  setTimeout(liveTick, 3000);

  // ---------- Météo réelle (METAR) ----------
  const COVER = { FEW: 'Peu', SCT: 'Épars', BKN: 'Fragmenté', OVC: 'Couvert', VV: 'Ciel invisible' };
  const WX = { RA: 'pluie', SHRA: 'averses', SH: 'averses', TS: 'orage', TSRA: 'orage avec pluie', DZ: 'bruine', BR: 'brume', FG: 'brouillard', HZ: 'brume sèche', SQ: 'grains', DU: 'poussière', SA: 'sable' };
  const CAT_TXT = { VFR: 'VFR', MVFR: 'MVFR', IFR: 'IFR', LIFR: 'LIFR' };
  let wxMode = 'mine';
  let wxCache = {};
  function wxPhenomena(str) {
    if (!str) return '';
    return str.split(' ').map((w) => {
      const m = /^([+-]?)(VC)?([A-Z]+)$/.exec(w); if (!m) return w;
      const base = WX[m[3]] || WX[m[3].slice(-2)] || m[3];
      return (m[2] ? base + ' à proximité' : base) + (m[1] === '-' ? ' faible' : m[1] === '+' ? ' forte' : '');
    }).join(', ');
  }
  function wxVis(v) {
    if (v == null || v === '') return '—';
    if (String(v).indexOf('+') !== -1) return '10 km ou plus';
    const km = Number(v) * 1.609;
    return isFinite(km) ? (km >= 10 ? '10 km ou plus' : (km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km')) : String(v);
  }
  function wxWind(m) {
    if (!m.wspd) return 'Calme';
    const dir = m.wdir === 'VRB' ? 'Variable' : String(m.wdir).padStart(3, '0') + '°';
    return dir + ' · ' + m.wspd + ' kt' + (m.wgst ? ' (rafales ' + m.wgst + ' kt)' : '');
  }
  function wxClouds(m) {
    if (m.cover === 'CAVOK') return 'CAVOK, ciel dégagé';
    const cl = (m.clouds || []).filter((c) => COVER[c.cover]);
    if (!cl.length) return 'Ciel dégagé';
    return cl.map((c) => COVER[c.cover] + ' à ' + Number(c.base).toLocaleString('fr-FR') + ' ft').join(', ');
  }
  function wxAge(m) {
    const min = Math.round((Date.now() / 1000 - m.obsTime) / 60);
    return isFinite(min) ? (min < 60 ? 'il y a ' + Math.max(min, 0) + ' min' : 'il y a ' + Math.round(min / 60) + ' h') : '';
  }
  function wxShort(m) {
    return (CAT_TXT[m.fltCat] || '') + ' · ' + wxWind(m) + ' · ' + (m.temp != null ? m.temp + ' °C' : '');
  }
  function wxIds() {
    if (wxMode === 'all') return Object.keys(AIRPORTS);
    const a = getActive();
    return a ? [a.from, a.to] : ['TFFR', 'TFFF'];
  }
  function renderWx(note) {
    const ids = wxIds();
    const rows = ids.map((id) => wxCache[id]).filter(Boolean);
    if (!rows.length) { $('wxList').className = 'muted small'; $('wxList').textContent = note || 'Pas de bulletin météo disponible.'; return; }
    const a = getActive();
    $('wxList').className = '';
    $('wxList').innerHTML = ids.map((id) => {
      const m = wxCache[id];
      const role = wxMode === 'mine' && a ? (id === a.from ? 'Départ' : 'Arrivée') : '';
      if (!m) return '<div class="wx"><div class="wx-top"><b>' + id + '</b><span class="muted small">pas de bulletin</span></div><div class="wx-name">' + esc(AIRPORTS[id] ? AIRPORTS[id][0] : '') + '</div></div>';
      const ph = wxPhenomena(m.wxString);
      return '<div class="wx"><div class="wx-top"><div><b>' + id + '</b>' + (role ? ' <span class="muted small">· ' + role + '</span>' : '') +
        '<div class="wx-name">' + esc(AIRPORTS[id] ? AIRPORTS[id][0] : (m.name || '')) + ' · ' + wxAge(m) + '</div></div>' +
        (m.fltCat ? '<span class="cat ' + esc(m.fltCat) + '">' + esc(m.fltCat) + '</span>' : '') + '</div>' +
        '<div class="wx-grid"><div><span>Vent</span>' + wxWind(m) + '</div><div><span>Visibilité</span>' + wxVis(m.visib) + '</div>' +
        '<div><span>Température</span>' + (m.temp != null ? m.temp + ' °C' : '—') + (m.dewp != null ? ' (rosée ' + m.dewp + ' °C)' : '') + '</div>' +
        '<div><span>QNH</span>' + (m.altim ? Math.round(m.altim) + ' hPa' : '—') + '</div>' +
        '<div style="grid-column:1/-1"><span>Nuages</span>' + wxClouds(m) + (ph ? ' · ' + esc(ph) : '') + '</div></div>' +
        '<details class="wx-raw"><summary>METAR brut</summary><code>' + esc(m.rawOb || '') + '</code></details></div>';
    }).join('');
    $('wxNote').textContent = note || 'Météo réelle des aéroports (METAR), mise à jour toutes les 10 minutes.';
  }
  function loadWx() {
    if (!window.acv || !window.acv.metar) { renderWx('Météo indisponible.'); return; }
    window.acv.metar(Object.keys(AIRPORTS)).then((r) => {
      if (r && r.ok) {
        r.metars.forEach((m) => { wxCache[m.icaoId] = m; });
        updateAirportTips();
        renderWx();
      } else renderWx(r && r.message);
    }).catch(() => renderWx('Météo injoignable (connexion ?)'));
  }
  function setWxMode(mode) {
    wxMode = mode;
    $('wxMine').classList.toggle('active', mode === 'mine');
    $('wxAll').classList.toggle('active', mode === 'all');
    renderWx();
  }
  $('wxMine').addEventListener('click', () => setWxMode('mine'));
  $('wxAll').addEventListener('click', () => setWxMode('all'));
  setInterval(loadWx, 10 * 60 * 1000);

  // ---------- Liaison simulateur ----------
  function phaseOf(d) {
    if (d.onGround) {
      if (d.gs < 2) return 'Stationné';
      if (d.gs < 40) return 'Roulage';
      return 'Piste';
    }
    if (d.vs > 300) return 'Montée';
    if (d.vs < -300) return 'Descente';
    return 'Croisière';
  }
  function showLive(d) {
    $('liveTitle').textContent = d.title || '—';
    $('liveAlt').textContent = Math.round(d.alt).toLocaleString('fr-FR') + ' ft';
    $('liveGs').textContent = Math.round(d.gs) + ' kt';
    $('liveHdg').textContent = pad2(Math.round(d.hdg) % 360).padStart(3, '0') + '°';
    $('liveVs').textContent = (d.vs > 0 ? '+' : '') + Math.round(d.vs) + ' ft/min';
    $('livePhase').textContent = phaseOf(d);
    $('livePos').textContent = d.lat.toFixed(2) + ' / ' + d.lon.toFixed(2);
  }
  function setSimStatus(s) {
    $('simPill').classList.toggle('on', !!s.connected);
    $('simPill').classList.toggle('off', !s.connected);
    $('simText').textContent = s.message || (s.connected ? 'Connecté' : 'Non connecté');
    simConnected = !!s.connected;
  }
  let simConnected = false;
  if (window.acv) {
    window.acv.simStatus().then(setSimStatus).catch(() => {});
    window.acv.onSimStatus(setSimStatus);
    window.acv.onSimData((d) => { myLast = d; showLive(d); updatePlane(d); track(d); updateProgress(d); });
    window.acv.version().then((v) => { $('version').textContent = 'v' + v; setTimeout(() => checkNews(v), 1200); }).catch(() => {});
  } else {
    setSimStatus({ connected: false, message: 'Liaison simulateur indisponible' });
  }

  // ---------- Suivi de vol et PIREP automatique ----------
  let lastAirborneVs = 0;
  function getActive() { return store.get('active', null); }
  function setActive(a) { store.set('active', a); renderActive(); drawRoute(a); if (typeof renderWx === 'function') renderWx(); if (typeof renderProfile === 'function') renderProfile(a); }

  function track(d) {
    const a = getActive();
    if (!a) return;
    if (a.state === 'prep' && !d.onGround && d.gs > 40) {
      a.state = 'airborne';
      a.takeoffAt = d.t;
      setActive(a);
      toast('Décollage enregistré pour ' + a.num + ' — bon vol !');
    }
    if (a.state === 'airborne') {
      if (!d.onGround) {
        lastAirborneVs = d.vs;
        a.maxAlt = Math.max(a.maxAlt || 0, Math.round(d.alt));
        store.set('active', a);
      } else {
        const arr = AIRPORTS[a.to];
        const distArr = distanceNm(d.lat, d.lon, arr[1], arr[2]);
        const blockMins = Math.max(1, Math.round((d.t - a.takeoffAt) / 60000));
        const pirep = {
          id: a.id, num: a.num, from: a.from, to: a.to, aircraft: a.aircraft,
          date: new Date().toLocaleDateString('fr-FR'),
          flightMins: blockMins,
          landingRate: Math.round(lastAirborneVs),
          maxAlt: a.maxAlt || 0,
          plane: d.title || '',
          status: distArr <= 15 ? 'Accepté' : 'Hors destination'
        };
        const list = store.get('pireps', []);
        list.unshift(pirep);
        store.set('pireps', list);
        submitLanding(pirep);
        store.set('bookings', store.get('bookings', []).filter((b) => b.id !== a.id));
        setActive(null);
        toast('Atterrissage ' + pirep.landingRate + ' ft/min — PIREP ' + pirep.num + ' enregistré (' + pirep.status + ')');
        renderPireps();
        renderBookings();
      }
    }
  }

  function ofpHtml(a) {
    const o = a.ofp;
    if (!o) return '';
    const warn = (o.from !== a.from || o.to !== a.to)
      ? '<div class="tag warn" style="margin-top:8px">Le plan SimBrief est ' + esc(o.from) + ' → ' + esc(o.to) + ', différent de ce vol</div>' : '';
    return '<div class="ofp">' +
      '<div class="ofp-grid"><div><span>Plan SimBrief</span><b>' + esc(o.flight || '—') + '</b></div>' +
      '<div><span>Croisière</span><b>' + esc(o.cruise || '—') + '</b></div>' +
      '<div><span>Carburant</span><b>' + esc(o.fuel || '—') + '</b></div>' +
      '<div><span>Temps prévu</span><b>' + (o.ete ? fmtDur(Math.round(o.ete / 60)) : '—') + '</b></div></div>' +
      '<div class="ofp-route">' + esc(o.route || 'Route directe') + '</div>' + warn + '</div>';
  }
  function importOfp() {
    const user = (store.get('profile', {}).simbrief || '').trim();
    if (!user) { toast('Ajoute ton identifiant SimBrief dans « Paramètres » d\'abord'); showView('parametres'); return; }
    if (!window.acv || !window.acv.simbriefFetch) { toast('Import SimBrief indisponible'); return; }
    toast('Import du plan SimBrief…');
    window.acv.simbriefFetch(user).then((r) => {
      if (!r.ok) { toast(r.message); return; }
      const a = getActive();
      if (!a) return;
      a.ofp = r.ofp;
      setActive(a);
      toast('Plan SimBrief importé : ' + r.ofp.from + ' → ' + r.ofp.to);
    }).catch(() => toast('Import SimBrief impossible pour le moment'));
  }

  function renderActive() {
    const a = getActive();
    const box = $('activeFlight');
    if (!a) {
      box.className = 'muted';
      box.textContent = 'Aucun vol démarré. Réserve un vol dans « Vols aléatoires », puis démarre-le dans « Mes vols ».';
      return;
    }
    const stateLabel = a.state === 'prep' ? 'En attente du décollage' : 'En vol';
    box.className = '';
    box.innerHTML =
      '<div class="row"><b style="color:#8f1238">' + esc(a.num) + '</b><span class="tag live">' + stateLabel + '</span></div>' +
      '<div style="font-family:var(--serif);font-size:30px;font-weight:700;margin:6px 0">' + esc(a.from) + ' → ' + esc(a.to) + '</div>' +
      '<div class="muted small">' + esc(AIRPORTS[a.from][0]) + ' → ' + esc(AIRPORTS[a.to][0]) + ' · ' + esc(a.aircraft) + '</div>' +
      '<div id="progressBox" class="progress-box"><div class="muted small">L\'avancement s\'affiche dès que MSFS est connecté. Le TOD (début de descente) est marqué sur la carte.</div></div>' +
      ofpHtml(a) +
      '<div class="actions"><button class="btn primary small" id="btnOfp">Importer mon plan SimBrief</button>' +
      '<button class="btn outline small" id="btnSbOpen">Ouvrir dans SimBrief</button>' +
      '<button class="btn outline small" id="btnAbort">Annuler le suivi</button></div>';
    $('btnAbort').addEventListener('click', () => { setActive(null); toast('Suivi du vol annulé'); });
    $('btnSbOpen').addEventListener('click', () => openUrl(simbriefUrl(a)));
    $('btnOfp').addEventListener('click', importOfp);
  }

  // ---------- Vols aléatoires ----------
  let cat = 'all';
  let plane = 'all';
  let current = makeFlight(cat, null, plane);
  let currentBooked = false;

  function renderCats() {
    $('catPills').innerHTML = Object.entries(CAT_LABELS).map(([id, label]) =>
      '<button class="pill' + (id === cat ? ' active' : '') + '" data-cat="' + id + '">' + label + '</button>').join('');
    $('catPills').querySelectorAll('.pill').forEach((p) => p.addEventListener('click', () => {
      cat = p.dataset.cat; newFlight();
    }));
  }
  function renderRandom() {
    const bk = $('btnBook');
    if (!current) {
      $('randomFlight').innerHTML = '<div class="empty">Aucune ligne ne correspond : le ' + esc(plane) + ' ne vole pas en « ' + CAT_LABELS[cat] + ' ». Choisis une autre catégorie ou un autre avion.</div>';
      bk.disabled = true; $('btnNewFlight').disabled = true;
      return;
    }
    bk.disabled = false; $('btnNewFlight').disabled = false;
    const f = current, a = AIRPORTS[f.from], b = AIRPORTS[f.to];
    $('randomFlight').innerHTML =
      '<div class="fb-top"><span style="color:#8f1238">' + f.num + '</span><span class="muted">' + CAT_LABELS[f.cat] + '</span></div>' +
      '<div class="fb-route"><div><div class="fb-code">' + f.from + '</div><div class="fb-city">' + esc(a[0]) + '</div></div>' +
      '<div class="fb-arrow">→</div>' +
      '<div style="text-align:right"><div class="fb-code">' + f.to + '</div><div class="fb-city">' + esc(b[0]) + '</div></div></div>' +
      '<div class="fb-grid"><div><span>Appareil</span><b>' + f.aircraft + '</b></div>' +
      '<div><span>Départ proposé</span><b>' + f.dep + '</b></div>' +
      '<div><span>Distance</span><b>' + f.nm + ' NM</b></div>' +
      '<div><span>Durée estimée</span><b>' + fmtDur(f.mins) + '</b></div></div>';
    bk.textContent = currentBooked ? 'Vol réservé' : 'Réserver ce vol';
    bk.classList.toggle('done', currentBooked);
  }
  function newFlight() {
    current = makeFlight(cat, current, plane);
    currentBooked = false;
    renderCats(); renderRandom(); renderPlaneRoutes();
  }
  function bookFlight(f) {
    const list = store.get('bookings', []);
    list.push(f);
    store.set('bookings', list);
    toast(f.num + ' ajouté à « Mes vols »');
  }
  function renderPlaneRoutes() {
    if (plane === 'all') {
      $('planeRoutesTitle').textContent = 'Vols par avion';
      $('planeRoutes').className = 'muted small';
      $('planeRoutes').textContent = 'Choisis un avion pour voir toutes les lignes qu\'il dessert.';
      return;
    }
    const legs = legsFor(cat, plane);
    $('planeRoutesTitle').textContent = 'Lignes en ' + plane;
    $('planeRoutes').className = '';
    if (!legs.length) { $('planeRoutes').innerHTML = '<div class="empty">Aucune ligne dans cette catégorie.</div>'; return; }
    $('planeRoutes').innerHTML = '<ul class="route-list">' + legs.map((l, k) =>
      '<li><div><b>' + l.from + ' → ' + l.to + '</b><div class="muted">' + esc(AIRPORTS[l.from][0]) + ' → ' + esc(AIRPORTS[l.to][0]) +
      ' · ' + l.nm + ' NM · ' + fmtDur(l.mins) + '</div></div>' +
      '<button class="btn outline small" data-leg="' + k + '">Réserver</button></li>').join('') + '</ul>';
    $('planeRoutes').querySelectorAll('[data-leg]').forEach((b) => b.addEventListener('click', () => {
      const f = flightFromLeg(legs[Number(b.dataset.leg)]);
      bookFlight(f);
      b.textContent = 'Réservé'; b.disabled = true;
    }));
  }
  $('planeSelect').addEventListener('change', (e) => { plane = e.target.value; newFlight(); });

  // ---------- Vols du jour : les mêmes pour tous les pilotes, tirés à partir de la date ----------
  function todayKey() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function seeded(seedText) {
    let h = 2166136261;
    for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function dailyFlights() {
    const day = todayKey();
    const rnd = seeded('acv-' + day);
    // 3 inter-îles, 1 Caraïbes, 1 transatlantique, sans doublon
    const plan = ['iles', 'iles', 'iles', 'carib', 'transat'];
    const used = new Set();
    return plan.map((c, i) => {
      const pool = LEGS.filter((l) => l.cat === c && !used.has(l.from + l.to));
      const l = pool[Math.floor(rnd() * pool.length)];
      used.add(l.from + l.to);
      const depMin = 6 * 60 + Math.floor(rnd() * 15) * 60 + [0, 15, 30, 45][Math.floor(rnd() * 4)];
      return Object.assign({}, l, {
        daily: day, id: 'daily-' + day + '-' + i,
        num: 'ACX ' + (100 + Math.floor(rnd() * 900)),
        dep: pad2(Math.floor(depMin / 60) % 24) + ':' + pad2(depMin % 60)
      });
    });
  }
  function renderDaily() {
    const list = dailyFlights();
    const today = new Date().toLocaleDateString('fr-FR');
    const pireps = store.get('pireps', []);
    const booked = store.get('bookings', []);
    let done = 0;
    $('dailyFlights').innerHTML = list.map((f, k) => {
      const isDone = pireps.some((p) => p.status === 'Accepté' && p.date === today && p.from === f.from && p.to === f.to);
      const isBooked = booked.some((b) => b.id === f.id);
      if (isDone) done++;
      return '<div class="daily' + (isDone ? ' done' : '') + '">' +
        '<div class="row small"><b style="color:#8f1238">' + f.num + '</b><span class="muted">' + f.dep + '</span></div>' +
        '<div class="route">' + f.from + ' → ' + f.to + '</div>' +
        '<div class="meta">' + esc(AIRPORTS[f.from][0]) + ' → ' + esc(AIRPORTS[f.to][0]) + '</div>' +
        '<div class="meta">' + esc(f.aircraft) + ' · ' + f.nm + ' NM · ' + fmtDur(f.mins) + '</div>' +
        (isDone ? '<span class="tag ok">Fait aujourd\'hui</span>'
          : '<button class="btn ' + (isBooked ? 'outline' : 'primary') + ' small" data-daily="' + k + '"' + (isBooked ? ' disabled' : '') + '>' + (isBooked ? 'Réservé' : 'Réserver') + '</button>') +
        '</div>';
    }).join('');
    $('dailyCount').textContent = done + ' / ' + list.length + ' faits';
    $('dailyFlights').querySelectorAll('[data-daily]').forEach((b) => b.addEventListener('click', () => {
      bookFlight(list[Number(b.dataset.daily)]);
      renderDaily();
    }));
  }
  $('btnNewFlight').addEventListener('click', newFlight);
  $('btnBook').addEventListener('click', () => {
    if (currentBooked || !current) return;
    bookFlight(current);
    currentBooked = true;
    renderRandom();
  });
  $('airportList').innerHTML = Object.entries(AIRPORTS).map(([code, a]) =>
    '<li><b>' + code + '</b><span class="muted">' + esc(a[0]) + '</span></li>').join('');

  // ---------- Mes vols ----------
  function renderBookings() {
    const list = store.get('bookings', []);
    const active = getActive();
    if (!list.length) {
      $('bookings').innerHTML = '<div class="empty">Aucun vol réservé pour le moment. Va dans « Vols aléatoires » pour en choisir un.</div>';
      return;
    }
    $('bookings').innerHTML = '<div class="table-wrap"><table><thead><tr><th>VOL</th><th>ROUTE</th><th>APPAREIL</th><th>DISTANCE</th><th>DURÉE</th><th>DÉPART</th><th></th></tr></thead><tbody>' +
      list.map((f) => {
        const isActive = active && active.id === f.id;
        return '<tr><td><b style="color:#8f1238">' + f.num + '</b></td>' +
          '<td>' + f.from + ' → ' + f.to + '<div class="muted small">' + esc(AIRPORTS[f.from][0]) + ' → ' + esc(AIRPORTS[f.to][0]) + '</div></td>' +
          '<td>' + f.aircraft + '</td><td>' + f.nm + ' NM</td><td>' + fmtDur(f.mins) + '</td><td>' + f.dep + '</td>' +
          '<td style="text-align:right;white-space:nowrap">' +
          (isActive ? '<span class="tag live">Suivi en cours</span>' :
            '<button class="btn outline small" data-simbrief="' + f.id + '">SimBrief</button> ' +
            '<button class="btn primary small" data-start="' + f.id + '">Démarrer</button> ' +
            '<button class="btn outline small" data-cancel="' + f.id + '">Annuler</button>') +
          '</td></tr>';
      }).join('') + '</tbody></table></div>';
    $('bookings').querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => {
      const f = store.get('bookings', []).find((x) => x.id === b.dataset.start);
      if (!f) return;
      setActive(Object.assign({}, f, { state: 'prep', startedAt: Date.now() }));
      renderBookings();
      showView('carte');
      toast('Suivi de ' + f.num + ' démarré : décolle de ' + f.from + ' dans MSFS 2024');
    }));
    $('bookings').querySelectorAll('[data-simbrief]').forEach((b) => b.addEventListener('click', () => {
      const f = store.get('bookings', []).find((x) => x.id === b.dataset.simbrief);
      if (!f) return;
      openUrl(simbriefUrl(f));
      toast('SimBrief s\'ouvre avec ' + f.num + ' déjà rempli. Génère ton plan, puis importe-le dans « Carte live ».');
    }));
    $('bookings').querySelectorAll('[data-cancel]').forEach((b) => b.addEventListener('click', () => {
      store.set('bookings', store.get('bookings', []).filter((x) => x.id !== b.dataset.cancel));
      renderBookings();
    }));
  }

  // ---------- PIREPs ----------
  function renderPireps() {
    const list = store.get('pireps', []);
    if (!list.length) {
      $('pireps').innerHTML = '<div class="empty">Pas encore de PIREP. Il s\'enregistre tout seul à l\'atterrissage d\'un vol suivi.</div>';
      return;
    }
    $('pireps').innerHTML = '<div class="table-wrap"><table><thead><tr><th>DATE</th><th>VOL</th><th>ROUTE</th><th>APPAREIL</th><th>TEMPS DE VOL</th><th>ALT. MAX</th><th>ATTERRISSAGE</th><th>STATUT</th></tr></thead><tbody>' +
      list.map((p) =>
        '<tr><td>' + esc(p.date) + '</td><td><b style="color:#8f1238">' + esc(p.num) + '</b></td><td>' + esc(p.from) + ' → ' + esc(p.to) + '</td>' +
        '<td>' + esc(p.aircraft) + '</td><td>' + fmtDur(p.flightMins) + '</td><td>' + Number(p.maxAlt).toLocaleString('fr-FR') + ' ft</td>' +
        '<td>' + p.landingRate + ' ft/min</td>' +
        '<td><span class="tag ' + (p.status === 'Accepté' ? 'ok' : 'warn') + '">' + esc(p.status) + '</span></td></tr>'
      ).join('') + '</tbody></table></div>';
  }

  // ---------- Classement des atterrissages (partagé entre pilotes) ----------
  function pilotIdentity() {
    const p = store.get('profile', {});
    return { pilot: (p.name || '').trim() || 'Pilote', callsign: (p.callsign || '').trim() };
  }
  function submitLanding(pirep) {
    if (!window.acv || !window.acv.boardSubmit || pirep.status !== 'Accepté') return;
    const id = pilotIdentity();
    window.acv.boardSubmit({
      id: pirep.id, pilot: id.pilot, callsign: id.callsign, num: pirep.num,
      route: pirep.from + ' → ' + pirep.to, aircraft: pirep.aircraft, rate: pirep.landingRate, status: pirep.status
    }).then((r) => { if (r && r.ok) toast('Ton atterrissage est dans le classement de la compagnie'); }).catch(() => {});
  }
  function localBoard() {
    const id = pilotIdentity();
    return store.get('pireps', []).filter((p) => p.status === 'Accepté').map((p) => ({
      pilot: id.pilot, callsign: id.callsign, num: p.num, route: p.from + ' → ' + p.to, aircraft: p.aircraft, rate: p.landingRate, date: p.date
    }));
  }
  function drawBoard(list, note) {
    list = list.filter((r) => isFinite(r.rate)).sort((a, b) => Math.abs(a.rate) - Math.abs(b.rate)).slice(0, 50);
    const me = pilotIdentity();
    const isMe = (r) => r.pilot === me.pilot && (r.callsign || '') === me.callsign;
    $('boardNote').textContent = note || '';
    if (!list.length) {
      $('podium').innerHTML = '';
      $('board').innerHTML = '<div class="empty">Pas encore d\'atterrissage classé. Démarre un vol dans « Mes vols » : ton poser sera noté à l\'arrivée.</div>';
      return;
    }
    $('podium').innerHTML = list.slice(0, 3).map((r, i) =>
      '<div class="pod r' + (i + 1) + '"><div class="rank">' + (i + 1) + '</div>' +
      '<div class="who">' + esc(r.pilot) + (r.callsign ? ' · ' + esc(r.callsign) : '') + '</div>' +
      '<div class="rate">' + Math.round(r.rate) + ' ft/min</div>' +
      '<div class="meta">' + esc(r.num) + ' · ' + esc(r.route) + ' · ' + esc(r.aircraft) + '</div></div>').join('');
    $('board').innerHTML = '<div class="table-wrap"><table><thead><tr><th>RANG</th><th>PILOTE</th><th>VOL</th><th>ROUTE</th><th>AVION</th><th>TAUX</th><th>DATE</th></tr></thead><tbody>' +
      list.map((r, i) => '<tr' + (isMe(r) ? ' class="me"' : '') + '><td class="num">' + (i + 1) + '</td><td><b>' + esc(r.pilot) + '</b>' +
        (r.callsign ? '<div class="muted small">' + esc(r.callsign) + '</div>' : '') + '</td><td>' + esc(r.num) + '</td><td>' + esc(r.route) +
        '</td><td>' + esc(r.aircraft) + '</td><td class="num">' + Math.round(r.rate) + ' ft/min</td><td>' + esc(r.date || '') + '</td></tr>').join('') +
      '</tbody></table></div>';
  }
  function renderBoard() {
    if (!window.acv || !window.acv.boardList) { drawBoard(localBoard(), 'Classement partagé indisponible : seuls tes atterrissages sont affichés.'); return; }
    $('boardNote').textContent = 'Chargement du classement…';
    window.acv.boardList().then((r) => {
      if (r && r.ok && Array.isArray(r.list)) drawBoard(r.list, 'Classement de toute la compagnie, du poser le plus doux au plus ferme.');
      else drawBoard(localBoard(), (r && r.message ? r.message + ' : ' : '') + 'seuls tes atterrissages sont affichés.');
    }).catch(() => drawBoard(localBoard(), 'Classement injoignable : seuls tes atterrissages sont affichés.'));
  }
  $('btnBoardRefresh').addEventListener('click', renderBoard);

  // ---------- Profil, accueil et voix ----------
  function welcomeScript(name) {
    const who = name && name.trim() ? name.trim() : 'commandant';
    return 'Moi, c\'est Ti-Pilote, ton assistant de bord. Bienvenue chez Air Caraïbe Virtual, ' + who + ' ! ' +
      'Depuis Pointe-à-Pitre et Fort-de-France, nos lignes t\'emmènent de Saint-Barth à Cayenne, jusqu\'à Paris-Orly. ' +
      'Rejoins notre Discord pour retrouver les autres pilotes, réserve ton premier vol, et lance MSFS 2024 : je m\'occupe du reste. ' +
      'Si tu as une question, clique sur moi en bas à droite de l\'écran !';
  }
  function refreshWelcome() {
    const n = $('wName').value.trim();
    const hello = isEvening() ? 'Bonsoir' : 'Bonjour';
    $('welcomeTitle').textContent = hello + ', commandant' + (n ? ' ' + n : '') + ' !';
    $('welcomeScript').textContent = welcomeScript(n);
  }
  function openWelcome() {
    const p = store.get('profile', {});
    $('wName').value = p.name || '';
    $('wCallsign').value = p.callsign || 'ACX';
    refreshWelcome();
    $('welcome').classList.remove('hidden');
    stopVoice();
    voiceTimer = setTimeout(speakWelcome, 600);
  }
  function closeWelcome() {
    stopVoice();
    const p = Object.assign({}, store.get('profile', {}), { name: $('wName').value.trim(), callsign: $('wCallsign').value.trim() });
    store.set('profile', p);
    loadProfile();
    $('welcome').classList.add('hidden');
    showView('vols');
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  }
  $('wName').addEventListener('input', refreshWelcome);
  $('btnStart').addEventListener('click', closeWelcome);
  $('btnReplayWelcome').addEventListener('click', openWelcome);

  // Musique zouk d'accueil (sans voix), lancée toute seule à l'ouverture de l'accueil.
  // Le titre dit « Bonjour » de 5 h à 18 h, « Bonsoir » le reste du temps.
  function isEvening() { const h = new Date().getHours(); return h >= 18 || h < 5; }
  const welcomeAudio = new Audio('assets/welcome-music.mp3');
  welcomeAudio.preload = 'auto';
  welcomeAudio.volume = 0.9;
  let voiceTimer = null;
  function setSpeaking(on) { $('voiceOn').classList.toggle('hidden', !on); $('tipiloteBig').classList.toggle('talking', on); }
  welcomeAudio.addEventListener('playing', () => setSpeaking(true));
  welcomeAudio.addEventListener('ended', () => setSpeaking(false));
  welcomeAudio.addEventListener('pause', () => setSpeaking(false));
  function stopVoice() {
    clearTimeout(voiceTimer);
    try { welcomeAudio.pause(); welcomeAudio.currentTime = 0; } catch (e) { /* rien */ }
    setSpeaking(false);
  }
  function speakWelcome() {
    try { welcomeAudio.currentTime = 0; } catch (e) { /* rien */ }
    const p = welcomeAudio.play();
    if (p && p.catch) p.catch(() => setSpeaking(false));
  }

  function loadProfile() {
    const p = store.get('profile', {});
    $('profName').value = p.name || '';
    $('profCallsign').value = p.callsign || '';
    $('setSimbrief').value = p.simbrief || '';
  }
  $('btnSaveProfile').addEventListener('click', () => {
    store.set('profile', Object.assign({}, store.get('profile', {}), { name: $('profName').value.trim(), callsign: $('profCallsign').value.trim() }));
    toast('Profil enregistré');
  });

  // ---------- Paramètres : identifiant SimBrief ----------
  function sbStatus(text, cls) { $('simbriefStatus').className = 'small ' + (cls || 'muted'); $('simbriefStatus').textContent = text; }
  $('btnSetSimbrief').addEventListener('click', () => {
    const v = $('setSimbrief').value.trim();
    if (v && !/^[A-Za-z0-9_.-]{2,40}$/.test(v)) { sbStatus('Identifiant invalide : lettres, chiffres, point, tiret ou souligné seulement.', 'status-err'); return; }
    store.set('profile', Object.assign({}, store.get('profile', {}), { simbrief: v }));
    sbStatus(v ? 'Identifiant SimBrief enregistré.' : 'Identifiant SimBrief retiré.', 'status-ok');
    toast(v ? 'Identifiant SimBrief enregistré' : 'Identifiant SimBrief retiré');
  });
  $('btnTestSimbrief').addEventListener('click', () => {
    const v = $('setSimbrief').value.trim();
    if (!v) { sbStatus('Entre d\'abord ton identifiant SimBrief.', 'status-err'); return; }
    if (!window.acv || !window.acv.simbriefFetch) { sbStatus('Test indisponible.', 'status-err'); return; }
    sbStatus('Recherche de ton dernier plan SimBrief…');
    window.acv.simbriefFetch(v).then((r) => {
      if (r && r.ok) sbStatus('Ça marche ! Dernier plan trouvé : ' + r.ofp.from + ' → ' + r.ofp.to + (r.ofp.flight ? ' (' + r.ofp.flight + ')' : '') + (r.ofp.cruise ? ', croisière ' + r.ofp.cruise : '') + '.', 'status-ok');
      else sbStatus((r && r.message) || 'Aucun plan trouvé pour cet identifiant.', 'status-err');
    }).catch(() => sbStatus('Impossible de joindre SimBrief.', 'status-err'));
  });

  document.querySelectorAll('.js-discord').forEach((b) => b.addEventListener('click', () => {
    if (window.acv) window.acv.openExternal(DISCORD_URL);
    else window.open(DISCORD_URL, '_blank');
  }));

  // ---------- Mises à jour ----------
  function showUpdate(s) {
    if (!s) return;
    $('updStatus').textContent = s.message;
    if (s.state === 'ready') {
      $('updBannerText').textContent = 'La version ' + s.version + ' est prête. Redémarre pour l\'installer.';
      $('updBanner').classList.remove('hidden');
    }
  }
  if (window.acv && window.acv.updateGetConfig) {
    window.acv.updateGetConfig().then((c) => showUpdate(c.status)).catch(() => {});
    window.acv.onUpdateStatus(showUpdate);
    $('btnUpdCheck').addEventListener('click', () => window.acv.updateCheck());
    $('btnUpdInstall').addEventListener('click', () => window.acv.updateInstall());
    $('btnUpdLater').addEventListener('click', () => $('updBanner').classList.add('hidden'));
  }

  // ---------- Ti-Pilote, le petit assistant ----------
  const HELP_PAGES = {
    carte: { title: 'La carte live', html: '<p>Ici tu suis ton avion en direct pendant le vol.</p><ul><li>Le voyant en haut à droite passe au vert quand MSFS 2024 est connecté.</li><li>« Plan » ou « Satellite » change le fond de carte.</li><li>La barre d\'avancement montre où tu en es, et l\'étiquette jaune <b>TOD</b> marque le début de descente.</li><li>« Importer mon plan SimBrief » affiche ta route complète.</li></ul>', go: null },
    vols: { title: 'Choisir un vol', html: '<p>Trois façons de trouver un vol :</p><ul><li><b>Vols du jour</b> : 5 vols communs à toute la compagnie.</li><li><b>Vol aléatoire</b> : clique sur « Proposer un autre vol » jusqu\'à ce qu\'il te plaise.</li><li><b>Avion</b> : choisis ton appareil pour voir toutes ses lignes.</li></ul><p>Clique sur « Réserver », puis va dans « Mes vols ».</p>', go: ['mesvols', 'Voir mes vols'] },
    mesvols: { title: 'Mes vols réservés', html: '<ol><li>« SimBrief » prépare ton plan de vol déjà rempli.</li><li>« Démarrer » lance le suivi : l\'ACARS attend ton décollage.</li><li>Pose-toi à destination : ton PIREP s\'enregistre tout seul.</li></ol>', go: ['vols', 'Réserver un vol'] },
    pireps: { title: 'Mes PIREPs', html: '<p>Chaque vol terminé devient un PIREP : temps de vol, altitude maximale et taux d\'atterrissage.</p><p>« Accepté » veut dire que tu t\'es posé à moins de 15 NM de l\'aéroport prévu.</p>', go: ['classement', 'Voir le classement'] },
    classement: { title: 'Le classement', html: '<p>Les atterrissages les plus doux de toute la compagnie. Plus le chiffre en ft/min est petit, plus le poser est doux.</p><p>Astuce : vise entre -60 et -200 ft/min pour un poser propre.</p>', go: null },
    profil: { title: 'Ton profil', html: '<p>Mets ton prénom et ton indicatif : c\'est le nom qui apparaît dans le classement.</p>', go: ['parametres', 'Ouvrir les paramètres'] },
    parametres: { title: 'Les paramètres', html: '<p>Ajoute ton identifiant SimBrief (nom d\'utilisateur ou Pilot ID) pour importer tes plans de vol en un clic.</p><p>« Tester avec mon dernier plan » vérifie que tout marche.</p><p>Tu y trouves aussi les nouveautés et les mises à jour.</p>', go: null }
  };
  const HELP_FAQ = [
    ['Le voyant reste orange, MSFS n\'est pas détecté', 'Lance d\'abord MSFS 2024 et attends d\'être dans le cockpit. L\'ACARS réessaie tout seul toutes les 5 secondes. La liaison ne marche que sur PC.'],
    ['Mon PIREP dit « Hors destination »', 'Tu t\'es posé à plus de 15 NM de l\'aéroport du vol démarré. Vérifie d\'avoir démarré le bon vol dans « Mes vols ».'],
    ['L\'import SimBrief ne marche pas', 'Mets ton identifiant SimBrief dans « Profil », génère ton plan sur SimBrief, puis clique sur « Importer mon plan SimBrief ».'],
    ['C\'est quoi le TOD ?', 'Top Of Descent : le point où tu commences ta descente. En général 3 NM par tranche de 1 000 ft à perdre.'],
    ['Comment rejoindre les autres pilotes ?', 'Sur notre serveur Discord : bouton dans l\'onglet « Profil ».']
  ];
  let helpMode = 'page';
  function helpSteps() {
    const p = store.get('profile', {});
    const steps = [
      [!!(p.name && p.name.trim()), 'Mettre ton prénom dans le profil', 'profil'],
      [store.get('bookings', []).length > 0 || store.get('pireps', []).length > 0 || !!getActive(), 'Réserver un premier vol', 'vols'],
      [!!getActive() || store.get('pireps', []).length > 0, 'Démarrer le vol dans « Mes vols »', 'mesvols'],
      [simConnected, 'Lancer MSFS 2024 (voyant vert)', null],
      [store.get('pireps', []).length > 0, 'Te poser : premier PIREP enregistré', 'pireps']
    ];
    return steps;
  }
  function renderHelper() {
    let html = '';
    if (helpMode === 'page') {
      const h = HELP_PAGES[currentView] || HELP_PAGES.carte;
      $('helperTitle').textContent = h.title;
      html = h.html + (h.go ? '<button class="btn primary small helper-go" data-go="' + h.go[0] + '">' + h.go[1] + '</button>' : '');
    } else if (helpMode === 'steps') {
      $('helperTitle').textContent = 'Tes premiers pas';
      const steps = helpSteps();
      const done = steps.filter((x) => x[0]).length;
      html = '<p>' + (done === steps.length ? 'Bravo, tu maîtrises l\'ACARS ! Bon vol, commandant.' : done + ' étape(s) sur ' + steps.length + ' faites. Clique sur une étape pour y aller.') + '</p>' +
        steps.map((x) => '<div class="check-step' + (x[0] ? ' ok' : '') + '"' + (x[2] && !x[0] ? ' data-go="' + x[2] + '" role="button" tabindex="0" style="cursor:pointer"' : '') + '><span class="box">' + (x[0] ? '✓' : '') + '</span><span>' + x[1] + '</span></div>').join('');
    } else {
      $('helperTitle').textContent = 'Questions fréquentes';
      html = HELP_FAQ.map((q) => '<details class="faq"><summary>' + q[0] + '</summary><p>' + q[1] + '</p></details>').join('');
    }
    $('helperBody').innerHTML = html;
    document.querySelectorAll('.helper-tabs .pill').forEach((b) => b.classList.toggle('active', b.dataset.help === helpMode));
    $('helperBody').querySelectorAll('[data-go]').forEach((el) => {
      const go = () => { showView(el.dataset.go); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }
  function helperOpen(mode) { if (mode) helpMode = mode; renderHelper(); $('helperBubble').classList.remove('hidden'); $('helperDot').classList.add('hidden'); store.set('helperSeen', true); }
  function helperClose() { $('helperBubble').classList.add('hidden'); }
  function helperOnView() { if (!$('helperBubble').classList.contains('hidden') && helpMode === 'page') renderHelper(); }
  $('helperBtn').addEventListener('click', () => { if ($('helperBubble').classList.contains('hidden')) helperOpen(); else helperClose(); });
  $('helperClose').addEventListener('click', helperClose);
  document.querySelectorAll('.helper-tabs .pill').forEach((b) => b.addEventListener('click', () => { helpMode = b.dataset.help; renderHelper(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') helperClose(); });
  // Première utilisation : Ti-Pilote se présente après l'accueil
  if (!store.get('helperSeen', false)) $('helperDot').classList.remove('hidden');
  $('btnStart').addEventListener('click', () => { if (!store.get('helperSeen', false)) setTimeout(() => helperOpen('steps'), 800); });

  // ---------- Quoi de neuf ? (après chaque mise à jour) ----------
  function cmpVersion(a, b) {
    const x = String(a).split(/[.-]/).map((n) => parseInt(n, 10) || 0), y = String(b).split(/[.-]/).map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); }
    return 0;
  }
  function newsHtml(entries) {
    const group = (items, cls, label) => items && items.length
      ? '<div class="news-group"><span class="tag ' + cls + '">' + label + '</span><ul>' + items.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : '';
    return entries.map((e) => '<div class="news-version"><h3>Version ' + esc(e.version) + ' <span>' + esc(e.date || '') + '</span></h3>' +
      group(e.added, 'ok', 'Ajouté') + group(e.fixed, 'info', 'Corrigé') + group(e.removed, 'removed', 'Retiré') + '</div>').join('');
  }
  function showNews(entries, sub) {
    if (!entries.length) return;
    $('newsSub').textContent = sub;
    $('newsBody').innerHTML = newsHtml(entries);
    $('news').classList.remove('hidden');
    $('newsClose').focus();
  }
  $('newsClose').addEventListener('click', () => $('news').classList.add('hidden'));
  $('btnNews').addEventListener('click', () => showNews(window.ACV_CHANGELOG || [], 'Toutes les nouveautés de l\'ACARS'));
  function checkNews(version) {
    const log = window.ACV_CHANGELOG || [];
    const seen = store.get('lastSeenVersion', null);
    store.set('lastSeenVersion', version);
    // Nouvelle installation : l'accueil suffit, pas de « Quoi de neuf ? »
    if (!seen || !store.get('profile', null)) return;
    if (cmpVersion(version, seen) <= 0) return;
    const fresh = log.filter((e) => cmpVersion(e.version, seen) > 0 && cmpVersion(e.version, version) <= 0);
    showNews(fresh, 'Ton ACARS vient de passer en version ' + version + '. Voici ce qui a changé :');
  }

  // ---------- Démarrage ----------
  initMap();
  if (store.get('mapSat', false)) setMapMode(true);
  if (store.get('wxRadar', false)) { $('wxRadar').checked = true; loadRadar(); }
  if (store.get('wxClouds', false)) { $('wxClouds').checked = true; setClouds(true); }
  wxLayerLabel();
  renderCats();
  renderRandom();
  renderDaily();
  renderProfile(getActive());
  loadWx();
  renderActive();
  drawRoute(getActive());
  loadProfile();
  if (!store.get('profile', null)) openWelcome();
})();
