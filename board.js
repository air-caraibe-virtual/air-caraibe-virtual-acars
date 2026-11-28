// Classement des atterrissages partagé entre pilotes (tableur Google caché derrière l'ACARS)
const BOARD_URL = 'https://script.google.com/macros/s/AKfycbySqOUDuB985wIO40iVe9pp_RkRE-qa4JETa6u-YqPRLde0sfUMa58jSLSXaP2q08y7XA/exec';
const BOARD_KEY = 'acv-445b2c6c42266694815ee83f';

const XBOX_URL = 'https://script.google.com/macros/s/AKfycbzBSl9KQbEb4_Ngfm9wkX95jA151VWjXwEAystrrcw7s9fL_RwqLMjEhDcpkC8iJhU/exec';

const REAL_TYPES = 'A359,A35K,A332,A333,AT75,AT76';
const realMemo = {};   // dernières positions connues (avions au-dessus de l'océan, sans couverture)
async function realDirect() {
  const res = await fetch('https://api.adsb.lol/v2/type/' + REAL_TYPES, { headers: { 'User-Agent': 'AirCaraibeVirtual-ACARS' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const d = await res.json(), now = Date.now(), at = d.now || now;
  (d.ac || []).forEach((a) => {
    const cs = String(a.flight || '').trim();
    if (cs.indexOf('FWI') !== 0 || a.lat == null || a.lon == null) return;
    const ground = a.alt_baro === 'ground';
    const prev = realMemo[a.hex];
    const landed = ground ? ((prev && prev.landed) || (prev && !prev.ground ? at : 0)) : 0;   // vient d'atterrir ?
    realMemo[a.hex] = {
      cs: cs.slice(0, 10), reg: String(a.r || '').slice(0, 10), type: String(a.t || '').slice(0, 6), lat: a.lat, lon: a.lon,
      alt: ground ? 0 : Math.round(Number(a.alt_baro) || Number(a.alt_geom) || 0), gs: Math.round(a.gs || 0),
      hdg: Math.round(a.track || a.true_heading || 0), vs: Math.round(a.baro_rate || 0), ground, landed,
      t: at - (Number(a.seen_pos) || 0) * 1000
    };
  });
  Object.keys(realMemo).forEach((k) => {
    const f = realMemo[k];
    if (now - f.t > 30 * 60000 || (f.ground && !f.landed && now - f.t > 10 * 60000) || (f.landed && now - f.landed > 30 * 60000 && now - f.t > 10 * 60000)) delete realMemo[k];
  });
  return { ok: true, live: true, at: now, refresh: 180, source: 'adsb.lol', flights: Object.keys(realMemo).map((k) => Object.assign({ id: k }, realMemo[k])) };
}

let accessCode = '';   // code d'accès personnel du pilote (ajouté à chaque envoi)

async function call(method, body, action) {
  if (!BOARD_URL) return { ok: false, message: 'Classement pas encore branché' };
  const opts = method === 'POST'
    ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: BOARD_KEY, code: accessCode }, body)), redirect: 'follow' }
    : { method: 'GET', redirect: 'follow' };
  const res = await fetch(BOARD_URL + (method === 'GET' ? '?action=' + (action || 'list') : ''), opts);
  return res.json();
}

module.exports = {
  configured: () => !!BOARD_URL,
  setCode: (c) => { accessCode = String(c || ''); },
  // Vérifie un code auprès de la compagnie : actif, retire, inconnu (ou null si pas de connexion)
  auth: async (code) => {
    try { const r = await call('POST', { action: 'auth', code: String(code || '') }); return r && r.ok ? r : null; } catch (e) { return null; }
  },
  submit: async (entry) => {
    try { return await call('POST', entry); } catch (e) { return { ok: false, message: 'Envoi impossible (connexion ?)' }; }
  },
  list: async () => {
    try { return await call('GET'); } catch (e) { return { ok: false, message: 'Classement injoignable (connexion ?)' }; }
  },
  // Avions en vol : envoie sa position et reçoit celle de tous les pilotes
  livePost: async (pos) => {
    try { return await call('POST', Object.assign({ action: 'pos' }, pos)); } catch (e) { return { ok: false }; }
  },
  idea: async (idea) => {
    try { return await call('POST', Object.assign({ action: 'idea' }, idea)); } catch (e) { return { ok: false, message: 'Envoi impossible (connexion ?)' }; }
  },
  // Vrais vols Air Caraïbes (positions ADS-B relayées par le service de la compagnie)
  // Vrais vols Air Caraïbes : demandés directement à adsb.lol depuis le PC du pilote
  // (le serveur Google est souvent refusé par adsb.lol, « trop de demandes »), sinon par le serveur
  realList: async () => {
    try { return await realDirect(); } catch (e) {
      try { return await call('GET', null, 'real&v=2'); } catch (e2) { return { ok: false }; }
    }
  },
  // Pilotes Xbox en vol (serveur des vols Xbox, déclarés sur le téléphone)
  xboxList: async () => {
    try { const res = await fetch(XBOX_URL + '?action=statuts', { redirect: 'follow' }); return await res.json(); } catch (e) { return { ok: false }; }
  },
  newsList: async () => {
    try { return await call('GET', null, 'news'); } catch (e) { return { ok: false }; }
  },
  liveList: async () => {
    try { return await call('GET', null, 'live'); } catch (e) { return { ok: false }; }
  }
};
