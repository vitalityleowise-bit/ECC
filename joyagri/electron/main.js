/* JOYAGRI — version Windows (Electron). Charge la même application HTML, hors ligne. */
'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const backupDir = () => path.join(app.getPath('documents'), 'JOYAGRI');

function createWindow() {
  const win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 380, title: 'JOYAGRI', backgroundColor: '#F7FAF4',
    icon: path.join(__dirname, '..', 'assets', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  // aucun lien externe ne s'ouvre dans l'application : seulement WhatsApp, dans le navigateur
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\/wa\.me\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
}

// Copie de sauvegarde dans Documents/JOYAGRI : un fichier par jour (30 jours gardés) + « dernier »
ipcMain.handle('backup:write', (_e, raw, day) => {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'joyagri-dernier.json'), raw, 'utf8');
  fs.writeFileSync(path.join(dir, `joyagri-${day}.json`), raw, 'utf8');
  const old = fs.readdirSync(dir).filter((f) => /^joyagri-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  while (old.length > 30) fs.unlinkSync(path.join(dir, old.shift()));
  return true;
});
ipcMain.handle('backup:readLatest', () => {
  const f = path.join(backupDir(), 'joyagri-dernier.json');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
});
ipcMain.handle('open:external', (_e, url) => { if (/^https:\/\/wa\.me\//.test(url)) shell.openExternal(url); });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
