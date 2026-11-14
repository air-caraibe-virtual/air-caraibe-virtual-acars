// Classement des atterrissages partagé entre pilotes (tableur Google caché derrière l'ACARS)
const BOARD_URL = 'https://script.google.com/macros/s/AKfycbySqOUDuB985wIO40iVe9pp_RkRE-qa4JETa6u-YqPRLde0sfUMa58jSLSXaP2q08y7XA/exec';
const BOARD_KEY = 'acv-445b2c6c42266694815ee83f';

async function call(method, body, action) {
  if (!BOARD_URL) return { ok: false, message: 'Classement pas encore branché' };
  const opts = method === 'POST'
    ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ key: BOARD_KEY }, body)), redirect: 'follow' }
    : { method: 'GET', redirect: 'follow' };
  const res = await fetch(BOARD_URL + (method === 'GET' ? '?action=' + (action || 'list') : ''), opts);
  return res.json();
}

module.exports = {
  configured: () => !!BOARD_URL,
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
  liveList: async () => {
    try { return await call('GET', null, 'live'); } catch (e) { return { ok: false }; }
  }
};
