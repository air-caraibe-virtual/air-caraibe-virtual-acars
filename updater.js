// Système de mise à jour automatique (versions publiées sur GitHub)
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const REPO = 'air-caraibe-virtual-acars';
const DEFAULT_OWNER = 'air-caraibe-virtual';
const CHECK_EVERY_MS = 2 * 60 * 60 * 1000; // toutes les 2 heures

let notify = () => {};
let configured = false;
let timer = null;
let lastStatus = { state: 'idle', message: 'Mises à jour pas encore configurées' };

function configPath() {
  return path.join(app.getPath('userData'), 'mise-a-jour.json');
}
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch (e) { return {}; }
}
function writeConfig(cfg) {
  try { fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2)); } catch (e) { /* rien */ }
}
function setStatus(state, message, extra) {
  lastStatus = Object.assign({ state, message }, extra || {});
  notify(lastStatus);
}
function validOwner(owner) {
  return typeof owner === 'string' && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner);
}

function configure(owner) {
  if (!validOwner(owner)) { configured = false; return false; }
  autoUpdater.setFeedURL({ provider: 'github', owner, repo: REPO });
  configured = true;
  return true;
}

function check() {
  if (!configured) {
    setStatus('idle', 'Mises à jour pas encore configurées');
    return;
  }
  if (!app.isPackaged) {
    setStatus('idle', 'Vérification possible uniquement dans le logiciel installé');
    return;
  }
  autoUpdater.checkForUpdates().catch((e) => {
    setStatus('error', 'Impossible de vérifier les mises à jour pour le moment');
  });
}

function init(onStatus) {
  notify = onStatus || notify;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => setStatus('checking', 'Recherche d\'une nouvelle version…'));
  autoUpdater.on('update-not-available', () => setStatus('uptodate', 'Le logiciel est à jour (v' + app.getVersion() + ')'));
  autoUpdater.on('update-available', (info) => setStatus('downloading', 'Nouvelle version ' + info.version + ' trouvée, téléchargement…', { version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => setStatus('downloading', 'Téléchargement de la mise à jour : ' + Math.round(p.percent) + ' %', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => setStatus('ready', 'La version ' + info.version + ' est prête à être installée', { version: info.version }));
  autoUpdater.on('error', () => setStatus('error', 'La mise à jour n\'a pas pu être vérifiée ou téléchargée'));

  const cfg = readConfig();
  if (configure(DEFAULT_OWNER)) {
    setTimeout(check, 8000);
  }
  timer = setInterval(check, CHECK_EVERY_MS);
}

function setOwner(owner) {
  owner = String(owner || '').trim();
  if (!validOwner(owner)) return { ok: false, message: 'Pseudo GitHub invalide' };
  writeConfig({ owner });
  configure(owner);
  check();
  return { ok: true };
}

module.exports = {
  init,
  check,
  setOwner,
  getConfig: () => ({ owner: readConfig().owner || DEFAULT_OWNER, repo: REPO, version: app.getVersion(), status: lastStatus }),
  install: () => autoUpdater.quitAndInstall(false, true),
  stop: () => clearInterval(timer)
};
