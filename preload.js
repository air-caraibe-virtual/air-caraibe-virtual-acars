// Pont sécurisé entre l'interface et le processus principal
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('acv', {
  version: () => ipcRenderer.invoke('app:version'),
  authCheck: (code) => ipcRenderer.invoke('auth:check', code),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  onAuthRevoked: (cb) => ipcRenderer.on('auth:revoked', () => cb()),
  simStatus: () => ipcRenderer.invoke('sim:getStatus'),
  onSimStatus: (cb) => ipcRenderer.on('sim:status', (_e, s) => cb(s)),
  onSimData: (cb) => ipcRenderer.on('sim:data', (_e, d) => cb(d)),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  simbriefFetch: (username) => ipcRenderer.invoke('simbrief:fetch', username),
  boardSubmit: (entry) => ipcRenderer.invoke('board:submit', entry),
  boardList: () => ipcRenderer.invoke('board:list'),
  livePost: (pos) => ipcRenderer.invoke('live:post', pos),
  liveList: () => ipcRenderer.invoke('live:list'),
  metar: (ids) => ipcRenderer.invoke('wx:metar', ids),
  radar: () => ipcRenderer.invoke('wx:radar'),
  updateGetConfig: () => ipcRenderer.invoke('update:getConfig'),
  updateSetOwner: (owner) => ipcRenderer.invoke('update:setOwner', owner),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateSetBeta: (on) => ipcRenderer.invoke('update:setBeta', on),
  ideaSend: (idea) => ipcRenderer.invoke('idea:send', idea),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb) => ipcRenderer.on('update:status', (_e, s) => cb(s))
});
