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
  const CAT_LABELS = { all: 'Tous', iles: 'Inter-îles', carib: 'Caraïbes', transat: 'Transatlantique' };

  function distanceNm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 2 * 3440.065 * Math.asin(Math.sqrt(h));
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtDur = (mins) => Math.floor(mins / 60) + ' h ' + pad2(Math.round(mins % 60));

  function makeFlight(cat, prev) {
    const pool = ROUTES.filter((r) => cat === 'all' || r[2] === cat);
    let r, from, to, tries = 0;
    do {
      r = pool[Math.floor(Math.random() * pool.length)];
      const flip = Math.random() < 0.5;
      from = flip ? r[1] : r[0]; to = flip ? r[0] : r[1];
      tries++;
    } while (prev && prev.from === from && prev.to === to && tries < 10);
    const a = AIRPORTS[from], b = AIRPORTS[to];
    const nm = Math.round(distanceNm(a[1], a[2], b[1], b[2]));
    let aircraft, speed;
    if (from === 'TFFJ' || to === 'TFFJ') { aircraft = 'DHC-6 Twin Otter'; speed = 150; }
    else if (r[2] === 'transat') { aircraft = 'Airbus A350-900'; speed = 480; }
    else if (nm < 350) { aircraft = 'ATR 72-600'; speed = 270; }
    else { aircraft = 'Airbus A320neo'; speed = 450; }
    const mins = Math.round(nm / speed * 60 + 20);
    const d = new Date(Date.now() + (30 + Math.floor(Math.random() * 43) * 5) * 60000);
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      num: 'ACX ' + (100 + Math.floor(Math.random() * 900)),
      from, to, aircraft, nm, mins, cat: r[2],
      dep: pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    };
  }

  // ---------- Navigation ----------
  let map = null;
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
  function showView(name) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    if (name === 'carte' && map) setTimeout(() => map.invalidateSize(), 50);
    if (name === 'mesvols') renderBookings();
    if (name === 'pireps') renderPireps();
  }

  // ---------- Fond photo : change toutes les 5 minutes ----------
  let photo = 0;
  setInterval(() => {
    photo = (photo + 1) % 2;
    $('bg1').classList.toggle('visible', photo === 0);
    $('bg2').classList.toggle('visible', photo === 1);
  }, 5 * 60 * 1000);

  // ---------- Carte (plan / satellite) ----------
  let planLayer, satLayer, planeMarker = null, trail = null, routeLine = null;
  function initMap() {
    if (typeof L === 'undefined') {
      $('map').innerHTML = '<div class="empty" style="padding:20px">La carte n\'a pas pu se charger.</div>';
      return;
    }
    map = L.map('map', { zoomControl: true, attributionControl: true }).setView([16.4, -61.6], 7);
    planLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);
    satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Imagerie &copy; Esri, Maxar, Earthstar Geographics'
    });
    Object.entries(AIRPORTS).forEach(([code, a]) => {
      L.circleMarker([a[1], a[2]], { radius: 6, color: '#ffffff', weight: 2, fillColor: '#8f1238', fillOpacity: 1 })
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
  function drawRoute(flight) {
    if (!map) return;
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    if (!flight) return;
    const a = AIRPORTS[flight.from], b = AIRPORTS[flight.to];
    routeLine = L.polyline([[a[1], a[2]], [b[1], b[2]]], { color: '#2b1a22', weight: 2, dashArray: '8 8' }).addTo(map);
  }

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
  }
  if (window.acv) {
    window.acv.simStatus().then(setSimStatus).catch(() => {});
    window.acv.onSimStatus(setSimStatus);
    window.acv.onSimData((d) => { showLive(d); updatePlane(d); track(d); });
    window.acv.version().then((v) => { $('version').textContent = 'v' + v; }).catch(() => {});
  } else {
    setSimStatus({ connected: false, message: 'Liaison simulateur indisponible' });
  }

  // ---------- Suivi de vol et PIREP automatique ----------
  let lastAirborneVs = 0;
  function getActive() { return store.get('active', null); }
  function setActive(a) { store.set('active', a); renderActive(); drawRoute(a); }

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
        store.set('bookings', store.get('bookings', []).filter((b) => b.id !== a.id));
        setActive(null);
        toast('Atterrissage ' + pirep.landingRate + ' ft/min — PIREP ' + pirep.num + ' enregistré (' + pirep.status + ')');
        renderPireps();
        renderBookings();
      }
    }
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
      '<div class="actions"><button class="btn outline small" id="btnAbort">Annuler le suivi</button></div>';
    $('btnAbort').addEventListener('click', () => { setActive(null); toast('Suivi du vol annulé'); });
  }

  // ---------- Vols aléatoires ----------
  let cat = 'all';
  let current = makeFlight(cat, null);
  let currentBooked = false;

  function renderCats() {
    $('catPills').innerHTML = Object.entries(CAT_LABELS).map(([id, label]) =>
      '<button class="pill' + (id === cat ? ' active' : '') + '" data-cat="' + id + '">' + label + '</button>').join('');
    $('catPills').querySelectorAll('.pill').forEach((p) => p.addEventListener('click', () => {
      cat = p.dataset.cat; newFlight();
    }));
  }
  function renderRandom() {
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
    const bk = $('btnBook');
    bk.textContent = currentBooked ? 'Vol réservé' : 'Réserver ce vol';
    bk.classList.toggle('done', currentBooked);
  }
  function newFlight() {
    current = makeFlight(cat, current);
    currentBooked = false;
    renderCats(); renderRandom();
  }
  $('btnNewFlight').addEventListener('click', newFlight);
  $('btnBook').addEventListener('click', () => {
    if (currentBooked) return;
    const list = store.get('bookings', []);
    list.push(current);
    store.set('bookings', list);
    currentBooked = true;
    renderRandom();
    toast(current.num + ' ajouté à « Mes vols »');
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

  // ---------- Profil, accueil et voix ----------
  function welcomeScript(name) {
    const who = name && name.trim() ? name.trim() : 'commandant';
    return 'Bonjour ' + who + ', et bienvenue chez Air Caraïbe Virtual ! Toute l\'équipe est ravie de vous compter parmi nos pilotes. ' +
      'Depuis Pointe-à-Pitre et Fort-de-France, nos lignes vous emmènent de Saint-Barthélemy à Cayenne, et jusqu\'à Paris-Orly. ' +
      'Rejoignez aussi notre serveur Discord pour retrouver les autres pilotes de la compagnie. ' +
      'Ensuite, réservez votre premier vol, lancez Microsoft Flight Simulator, et notre ACARS s\'occupe du reste. ' +
      'Attachez vos ceintures, et bon vol au soleil des Antilles !';
  }
  function refreshWelcome() {
    const n = $('wName').value.trim();
    $('welcomeTitle').textContent = n ? 'Bienvenue, commandant ' + n + ' !' : 'Bienvenue, commandant !';
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
    const p = { name: $('wName').value.trim(), callsign: $('wCallsign').value.trim() };
    store.set('profile', p);
    loadProfile();
    $('welcome').classList.add('hidden');
    showView('vols');
    setTimeout(() => { if (map) map.invalidateSize(); }, 100);
  }
  $('wName').addEventListener('input', refreshWelcome);
  $('btnStart').addEventListener('click', closeWelcome);
  $('btnReplayWelcome').addEventListener('click', openWelcome);

  // Message d'accueil enregistré (voix + musique des îles), lancé tout seul à l'ouverture de l'accueil.
  const welcomeAudio = new Audio('assets/welcome.mp3');
  welcomeAudio.preload = 'auto';
  welcomeAudio.volume = 0.9;
  let voiceTimer = null;
  function setSpeaking(on) { $('voiceOn').classList.toggle('hidden', !on); }
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
  }
  $('btnSaveProfile').addEventListener('click', () => {
    store.set('profile', { name: $('profName').value.trim(), callsign: $('profCallsign').value.trim() });
    toast('Profil enregistré');
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

  // ---------- Démarrage ----------
  initMap();
  if (store.get('mapSat', false)) setMapMode(true);
  renderCats();
  renderRandom();
  renderActive();
  drawRoute(getActive());
  loadProfile();
  if (!store.get('profile', null)) openWelcome();
})();
