// Air Caraïbe Virtual — ACARS bêta (processus principal Electron)
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { SimLink } = require('./sim');
const updater = require('./updater');

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
