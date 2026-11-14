/* Air Caraïbe Virtual — appli téléphone (pilotes en vol, vols du jour, classement, météo) */
(function () {
  'use strict';
  const SERVICE = 'https://script.google.com/macros/s/AKfycbySqOUDuB985wIO40iVe9pp_RkRE-qa4JETa6u-YqPRLde0sfUMa58jSLSXaP2q08y7XA/exec';
  const $ = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDur = (m) => Math.floor(m / 60) + ' h ' + pad2(Math.round(m % 60));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, f) { try { const v = localStorage.getItem('acvm.' + k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem('acvm.' + k, JSON.stringify(v)); } catch (e) { /* rien */ } }
  };
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3500);
  }
  async function getJSON(url) { const r = await fetch(url, { cache: 'no-store' }); return r.json(); }

  // ---------- Réseau de la compagnie (identique à l'ACARS PC, pour avoir les mêmes vols du jour) ----------
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
  const CAT_LABELS = { iles: 'Inter-îles', carib: 'Caraïbes', transat: 'Transatlantique' };
  const SIMBRIEF_TYPES = { 'DHC-6 Twin Otter': 'DHC6', 'ATR 72-600': 'AT76', 'Airbus A320neo': 'A20N', 'Airbus A350-900': 'A359' };
  function distanceNm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 3440.065 * Math.asin(Math.sqrt(h));
  }
  function planeFor(from, to, cat, nm) {
    if (from === 'TFFJ' || to === 'TFFJ') return { aircraft: 'DHC-6 Twin Otter', speed: 150 };
    if (cat === 'transat') return { aircraft: 'Airbus A350-900', speed: 480 };
    if (nm < 350) return { aircraft: 'ATR 72-600', speed: 270 };
    return { aircraft: 'Airbus A320neo', speed: 450 };
  }
  const LEGS = [];
  ROUTES.forEach(([x, y, c]) => {
    [[x, y], [y, x]].forEach(([from, to]) => {
      const a = AIRPORTS[from], b = AIRPORTS[to];
      const nm = Math.round(distanceNm(a[1], a[2], b[1], b[2]));
      const p = planeFor(from, to, c, nm);
      LEGS.push({ from, to, cat: c, nm, aircraft: p.aircraft, mins: Math.round(nm / p.speed * 60 + 20) });
    });
  });
  function todayKey() { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function seeded(seedText) {
    let h = 2166136261;
    for (let i = 0; i < seedText.length; i++) { h ^= seedText.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function dailyFlights() {
    const day = todayKey();
    const rnd = seeded('acv-' + day);
    const plan = ['iles', 'iles', 'iles', 'carib', 'transat'];
    const used = new Set();
    return plan.map((c, i) => {
      const pool = LEGS.filter((l) => l.cat === c && !used.has(l.from + l.to));
      const l = pool[Math.floor(rnd() * pool.length)];
      used.add(l.from + l.to);
      const depMin = 6 * 60 + Math.floor(rnd() * 15) * 60 + [0, 15, 30, 45][Math.floor(rnd() * 4)];
      return Object.assign({}, l, { num: 'ACX ' + (100 + Math.floor(rnd() * 900)), dep: pad2(Math.floor(depMin / 60) % 24) + ':' + pad2(depMin % 60) });
    });
  }
  function simbriefUrl(f) {
    const q = new URLSearchParams({ airline: 'ACX', fltnum: String(f.num).replace(/\D/g, ''), type: SIMBRIEF_TYPES[f.aircraft] || '',
      orig: f.from, dest: f.to, deph: f.dep.slice(0, 2), depm: f.dep.slice(3, 5), steh: String(Math.floor(f.mins / 60)), stem: String(f.mins % 60) });
    return 'https://dispatch.simbrief.com/options/custom?' + q.toString();
  }

  // ---------- Navigation ----------
  const SUBS = { carte: 'Pilotes en vol', vols: 'Vols du jour', classement: 'Classement', meteo: 'Météo', infos: 'Infos' };
  let view = 'carte';
  function show(v) {
    view = v;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.v === v));
    document.querySelectorAll('.view').forEach((s) => s.classList.toggle('active', s.id === 'v-' + v));
    $('topSub').textContent = SUBS[v];
    if (v === 'carte' && map) setTimeout(() => map.invalidateSize(), 60);
    if (v === 'classement') loadBoard();
    if (v === 'meteo') loadWx();
    if (v === 'vols') renderDaily();
    try { history.replaceState(null, '', '#' + v); } catch (e) { /* rien */ }
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.v)));

  // ---------- Carte live ----------
  let map, planLayer, satLayer, radarLayer = null;
  const markers = {};
  let selected = null;
  const PLANE = '<svg width="34" height="34" viewBox="-17 -17 34 34" style="display:block;transform-origin:center"><path d="M0 -16 C 2 -16 3 -12 3 -8 L3 -3 L16 4 L16 7 L3 4 L2 11 L6 14 L6 16 L0 15 L-6 16 L-6 14 L-2 11 L-3 4 L-16 7 L-16 4 L-3 -3 L-3 -8 C -3 -12 -2 -16 0 -16 Z" fill="#0e8a9a" stroke="#ffffff" stroke-width="1.6"/></svg>';
  function initMap() {
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([15.8, -61.6], 6);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    planLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap' }).addTo(map);
    satLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: '&copy; Esri, Maxar' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 })
    ]);
    Object.entries(AIRPORTS).forEach(([code, a]) => {
      L.circleMarker([a[1], a[2]], { radius: 6, color: '#fff', weight: 2, fillColor: '#8f1238', fillOpacity: 1 }).addTo(map)
        .bindTooltip(code + ' · ' + a[0], { direction: 'top', className: 'apt-tip', offset: [0, -6] });
    });
    map.on('click', () => closeSheet());
    if (store.get('sat', false)) setSat(true);
    if (store.get('radar', false)) setRadar(true);
  }
  function setSat(on) {
    if (on) { map.removeLayer(planLayer); satLayer.addTo(map); } else { map.removeLayer(satLayer); planLayer.addTo(map); }
    $('btnSat').classList.toggle('active', on); $('btnPlan').classList.toggle('active', !on); store.set('sat', on);
  }
  async function setRadar(on) {
    $('btnRadar').setAttribute('aria-pressed', String(on)); store.set('radar', on);
    if (radarLayer) { map.removeLayer(radarLayer); radarLayer = null; }
    if (!on) return;
    try {
      const d = await getJSON('https://api.rainviewer.com/public/weather-maps.json');
      const last = d.radar.past[d.radar.past.length - 1];
      radarLayer = L.tileLayer(d.host + last.path + '/256/{z}/{x}/{y}/2/1_1.png', { opacity: 0.7, maxNativeZoom: 7, maxZoom: 18, zIndex: 400, attribution: 'Radar &copy; RainViewer' }).addTo(map);
      const t = new Date(last.time * 1000); toast('Radar de ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes()));
    } catch (e) { toast('Radar indisponible pour le moment'); $('btnRadar').setAttribute('aria-pressed', 'false'); }
  }
  $('btnPlan').addEventListener('click', () => setSat(false));
  $('btnSat').addEventListener('click', () => setSat(true));
  $('btnRadar').addEventListener('click', () => setRadar($('btnRadar').getAttribute('aria-pressed') !== 'true'));

  function altText(ft) { return ft >= 18000 ? 'FL' + String(Math.round(ft / 100)).padStart(3, '0') : Math.round(ft).toLocaleString('fr-FR') + ' ft'; }
  function openSheet(p) {
    selected = p.id;
    $('sheetBody').innerHTML = '<div class="who">' + esc(p.pilot) + (p.callsign ? ' · ' + esc(p.callsign) : '') + '</div>' +
      '<div class="muted" style="margin:2px 0 0">' + esc(p.num || 'Vol libre') + (p.route ? ' · ' + esc(p.route) : '') + (p.aircraft ? ' · ' + esc(p.aircraft) : '') + '</div>' +
      '<div class="grid2"><div><span>Altitude</span><b>' + altText(p.alt) + '</b></div><div><span>Vitesse sol</span><b>' + Math.round(p.gs) + ' kt</b></div>' +
      '<div><span>Cap</span><b>' + String(Math.round(p.hdg) % 360).padStart(3, '0') + '°</b></div><div><span>Phase</span><b>' + esc(p.phase || '—') + '</b></div></div>';
    $('sheet').classList.remove('hidden');
  }
  function closeSheet() { selected = null; $('sheet').classList.add('hidden'); }
  $('sheetClose').addEventListener('click', closeSheet);

  function drawLive(list) {
    const seen = {};
    list.forEach((p) => {
      seen[p.id] = true;
      if (!markers[p.id]) {
        markers[p.id] = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'plane-ic', html: PLANE, iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 800 })
          .addTo(map).on('click', (e) => { L.DomEvent.stopPropagation(e); openSheet(markers[p.id].data); });
      } else markers[p.id].setLatLng([p.lat, p.lon]);
      markers[p.id].data = p;
      const el = markers[p.id].getElement(); if (el) { const s = el.querySelector('svg'); if (s) s.style.transform = 'rotate(' + p.hdg + 'deg)'; }
      if (selected === p.id) openSheet(p);
    });
    Object.keys(markers).forEach((id) => { if (!seen[id]) { map.removeLayer(markers[id]); delete markers[id]; if (selected === id) closeSheet(); } });
    const n = list.length;
    $('liveBadge').textContent = n + ' en vol';
  }
  async function loadLive() {
    try { const d = await getJSON(SERVICE + '?action=live'); if (d && d.ok) drawLive(d.live || []); } catch (e) { /* hors ligne */ }
  }

  // ---------- Vols du jour ----------
  function renderDaily() {
    $('daily').innerHTML = dailyFlights().map((f) =>
      '<div class="item"><div class="row"><span class="num">' + f.num + '</span><span class="meta">' + CAT_LABELS[f.cat] + ' · ' + f.dep + '</span></div>' +
      '<div class="route">' + f.from + ' → ' + f.to + '</div>' +
      '<div class="meta">' + esc(AIRPORTS[f.from][0]) + ' → ' + esc(AIRPORTS[f.to][0]) + '</div>' +
      '<div class="meta">' + f.aircraft + ' · ' + f.nm + ' NM · ' + fmtDur(f.mins) + '</div>' +
      '<a class="btn outline small" href="' + simbriefUrl(f) + '" target="_blank" rel="noopener">Préparer sur SimBrief</a></div>').join('');
  }

  // ---------- Classement ----------
  async function loadBoard() {
    $('board').innerHTML = '<div class="empty">Chargement…</div>';
    try {
      const d = await getJSON(SERVICE + '?action=list');
      const list = (d && d.list) || [];
      if (!list.length) { $('podium').innerHTML = ''; $('board').innerHTML = '<div class="empty">Pas encore d\'atterrissage classé.</div>'; return; }
      $('podium').innerHTML = list.slice(0, 3).map((r, i) => '<div class="pod r' + (i + 1) + '"><div class="rk">' + (i + 1) + '</div><div class="who">' + esc(r.pilot) + '</div><div class="rate">' + Math.round(r.rate) + '</div><div class="meta" style="font-size:11px;color:var(--muted)">ft/min</div></div>').join('');
      $('board').innerHTML = list.map((r, i) => '<div class="item"><div class="row" style="justify-content:flex-start;gap:12px"><span class="rank">' + (i + 1) + '</span>' +
        '<div style="flex:1;min-width:0"><b>' + esc(r.pilot) + '</b>' + (r.callsign ? ' <span class="meta">· ' + esc(r.callsign) + '</span>' : '') +
        '<div class="meta">' + esc(r.num) + ' · ' + esc(r.route) + ' · ' + esc(r.aircraft) + '</div></div>' +
        '<b class="num">' + Math.round(r.rate) + ' ft/min</b></div></div>').join('');
    } catch (e) { $('board').innerHTML = '<div class="empty">Classement injoignable. Vérifie ta connexion.</div>'; }
  }
  $('btnBoard').addEventListener('click', loadBoard);

  // ---------- Météo (METAR relayés par le service de la compagnie) ----------
  const COVER = { FEW: 'Peu', SCT: 'Épars', BKN: 'Fragmenté', OVC: 'Couvert' };
  function wxVis(v) { if (v == null) return '—'; if (String(v).indexOf('+') !== -1) return '10 km et +'; const km = Number(v) * 1.609; return isFinite(km) ? (km >= 10 ? '10 km et +' : km.toFixed(1).replace('.', ',') + ' km') : String(v); }
  function wxWind(m) { if (!m.wspd) return 'Calme'; return (m.wdir === 'VRB' ? 'Variable' : String(m.wdir).padStart(3, '0') + '°') + ' · ' + m.wspd + ' kt' + (m.wgst ? ' (raf. ' + m.wgst + ')' : ''); }
  function wxClouds(m) { if (m.cover === 'CAVOK') return 'CAVOK'; const c = (m.clouds || []).filter((x) => COVER[x.cover]); return c.length ? c.map((x) => COVER[x.cover] + ' ' + Number(x.base).toLocaleString('fr-FR') + ' ft').join(', ') : 'Dégagé'; }
  async function loadWx() {
    $('wx').innerHTML = '<div class="empty">Chargement de la météo…</div>';
    try {
      const d = await getJSON(SERVICE + '?action=metar');
      if (!d || !d.ok) throw new Error('ko');
      const by = {}; (d.metars || []).forEach((m) => { by[m.icaoId] = m; });
      $('wx').innerHTML = Object.keys(AIRPORTS).map((id) => {
        const m = by[id];
        if (!m) return '<div class="item"><div class="row"><b>' + id + '</b><span class="meta">pas de bulletin</span></div><div class="meta">' + esc(AIRPORTS[id][0]) + '</div></div>';
        const min = Math.max(0, Math.round((Date.now() / 1000 - m.obsTime) / 60));
        return '<div class="item"><div class="row"><div><b>' + id + '</b> <span class="meta">· ' + esc(AIRPORTS[id][0]) + '</span></div>' + (m.fltCat ? '<span class="cat ' + esc(m.fltCat) + '">' + esc(m.fltCat) + '</span>' : '') + '</div>' +
          '<div class="wxg"><div><span>Vent</span>' + wxWind(m) + '</div><div><span>Visibilité</span>' + wxVis(m.visib) + '</div>' +
          '<div><span>Température</span>' + (m.temp != null ? m.temp + ' °C' : '—') + '</div><div><span>QNH</span>' + (m.altim ? Math.round(m.altim) + ' hPa' : '—') + '</div>' +
          '<div style="grid-column:1/-1"><span>Nuages</span>' + wxClouds(m) + '</div></div>' +
          '<div class="meta" style="margin-top:6px">Bulletin d\'il y a ' + (min < 60 ? min + ' min' : Math.round(min / 60) + ' h') + '</div></div>';
      }).join('');
      $('wxNote').textContent = 'Bulletins réels des aéroports (METAR), mis à jour toutes les 10 minutes.';
    } catch (e) { $('wx').innerHTML = '<div class="empty">Météo injoignable pour le moment.</div>'; }
  }

  // ---------- Installation sur l'écran d'accueil ----------
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('btnInstall').classList.remove('hidden'); });
  $('btnInstall').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* rien */ } installEvt = null; $('btnInstall').classList.add('hidden'); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  // ---------- Démarrage ----------
  initMap();
  loadLive();
  setInterval(loadLive, 20000);
  const start = (location.hash || '').slice(1);
  show(SUBS[start] ? start : 'carte');
  if (!store.get('seen', false)) { store.set('seen', true); setTimeout(() => toast('Bienvenue à bord ! Les avions turquoise sont les pilotes en vol.'), 800); }
})();
