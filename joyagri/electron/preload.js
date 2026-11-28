/* Pont minimal et sûr entre l'application et Windows. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('JoyNative', {
  writeBackup: (raw, day) => ipcRenderer.invoke('backup:write', raw, day),
  readLatest: () => ipcRenderer.invoke('backup:readLatest'),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
});
