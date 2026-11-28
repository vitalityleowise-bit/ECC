'use strict';
/* Expose à la page le même pont « UnieNative » que l'application Android. */
const { contextBridge, ipcRenderer } = require('electron');

function call(channel, ...args) {
  const r = ipcRenderer.sendSync(channel, ...args);
  if (typeof r === 'string' && r.startsWith('ERR:')) throw new Error(r.slice(4));
  return r;
}
contextBridge.exposeInMainWorld('UnieNative', {
  platform: 'windows',
  saveData: (json) => call('unie:saveData', json),
  loadData: () => call('unie:loadData'),
  saveFile: (name, text) => call('unie:saveFile', name, text),
  shareFile: (name, text) => call('unie:shareFile', name, text),
  dataFolder: () => call('unie:dataFolder'),
  openFolder: () => call('unie:openFolder'),
  getPendingImport: () => call('unie:pending'),
  notify: (title, body) => call('unie:notify', title, body),
  scheduleAlarms: (json) => call('unie:alarms', json),
});
