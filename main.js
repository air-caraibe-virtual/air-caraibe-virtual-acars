// Air Caraïbe Virtual — ACARS bêta (processus principal Electron)
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { SimLink } = require('./sim');
const updater = require('./updater');
const board = require('./board');

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
const sim = new SimLink();

function isSafeExternal(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1000,
    minHeight: 680,
    title: 'Air Caraïbe Virtual — ACARS bêta',
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'),
    backgroundColor: '#2b1a22',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Les liens externes (Discord, etc.) s'ouvrent dans le navigateur, jamais dans l'appli.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (isSafeExternal(url)) shell.openExternal(url);
    }
  });

  win.on('closed', () => { win = null; });
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

sim.on('status', (s) => send('sim:status', s));
sim.on('data', (d) => send('sim:data', d));

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('board:submit', (_e, entry) => board.submit(entry));
ipcMain.handle('board:list', () => board.list());
ipcMain.handle('live:post', (_e, pos) => board.livePost(pos));
ipcMain.handle('live:list', () => board.liveList());
// Météo réelle des aéroports (METAR, aviationweather.gov, gratuit et sans clé)
ipcMain.handle('wx:metar', async (_e, ids) => {
  const list = [].concat(ids || []).map((x) => String(x).toUpperCase()).filter((x) => /^[A-Z]{4}$/.test(x)).slice(0, 20);
  if (!list.length) return { ok: false, message: 'Aucun aéroport' };
  try {
    const res = await fetch('https://aviationweather.gov/api/data/metar?format=json&ids=' + list.join(','));
    const data = await res.json();
    return { ok: true, metars: Array.isArray(data) ? data : [] };
  } catch (e) {
    return { ok: false, message: 'Météo injoignable (connexion ?)' };
  }
});
ipcMain.handle('simbrief:fetch', async (_e, username) => {
  username = String(username || '').trim();
  if (!/^[A-Za-z0-9_.-]{2,40}$/.test(username)) return { ok: false, message: 'Identifiant SimBrief invalide' };
  try {
    const res = await fetch('https://www.simbrief.com/api/xml.fetcher.php?username=' + encodeURIComponent(username) + '&json=1');
    const d = await res.json();
    if (!d || !d.origin || !d.destination) {
      const why = d && d.fetch && d.fetch.status ? String(d.fetch.status) : 'aucun plan trouvé';
      return { ok: false, message: 'SimBrief : ' + why };
    }
    const fixes = (d.navlog && d.navlog.fix ? [].concat(d.navlog.fix) : [])
      .map((f) => ({ id: f.ident, lat: parseFloat(f.pos_lat), lon: parseFloat(f.pos_long) }))
      .filter((f) => isFinite(f.lat) && isFinite(f.lon));
    const g = d.general || {}, fuel = d.fuel || {}, times = d.times || {}, params = d.params || {};
    return {
      ok: true,
      ofp: {
        from: d.origin.icao_code, to: d.destination.icao_code,
        flight: (g.icao_airline || '') + (g.flight_number || ''),
        aircraft: (d.aircraft && (d.aircraft.icaocode || d.aircraft.name)) || '',
        route: g.route || '',
        cruise: g.initial_altitude ? 'FL' + String(Math.round(Number(g.initial_altitude) / 100)).padStart(3, '0') : '',
        fuel: fuel.plan_ramp ? fuel.plan_ramp + ' ' + (params.units || '') : '',
        ete: times.est_time_enroute ? Number(times.est_time_enroute) : 0,
        fixes
      }
    };
  } catch (e) {
    return { ok: false, message: 'Impossible de joindre SimBrief (vérifie ta connexion Internet)' };
  }
});
ipcMain.handle('update:getConfig', () => updater.getConfig());
ipcMain.handle('update:setOwner', (_e, owner) => updater.setOwner(owner));
ipcMain.handle('update:check', () => updater.check());
ipcMain.handle('update:install', () => updater.install());
ipcMain.handle('sim:getStatus', () => sim.status);
ipcMain.handle('open-external', (_e, url) => {
  if (isSafeExternal(url)) shell.openExternal(url);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    createWindow();
    sim.start();
    updater.init((s) => send('update:status', s));
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('window-all-closed', () => {
  sim.stop();
  updater.stop();
  if (process.platform !== 'darwin') app.quit();
});
