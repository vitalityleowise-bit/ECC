'use strict';
/* UNIE-MUSO pour Windows : fenêtre application + dossier de données Documents\UNIE-MUSO
   + ouverture des fichiers .unimiso + alarmes de réunion (icône dans la zone de notification). */
const { app, BrowserWindow, ipcMain, shell, Notification, Tray, Menu, nativeImage, dialog, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

/* La page est servie sur app://unie-muso/ (origine sécurisée) : la version en ligne (Firebase)
   refuse les pages file://. Les données locales restent dans Documents\UNIE-MUSO. */
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);
function registerAppProtocol() {
  const root = path.join(__dirname, 'app');
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'UNIE-MUSO.html';
    const file = path.normalize(path.join(root, rel));
    if (!file.startsWith(root + path.sep)) return new Response('Interdit', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

const APP_ID = 'ht.uniemuso.app';
let win = null;
let tray = null;
let quitting = false;
let pendingImport = '';
let alarmTimers = [];

function dataDir() {
  const dir = path.join(app.getPath('documents'), 'UNIE-MUSO');
  fs.mkdirSync(path.join(dir, 'sauvegardes'), { recursive: true });
  return dir;
}
const DATA_FILE = () => path.join(dataDir(), 'donnees-uniemuso.unimiso');

/* Fichier passé en argument (double-clic sur un .unimiso / .json) */
function fileFromArgv(argv) {
  return (argv || []).slice(1).find((a) => /\.(unimiso|json)$/i.test(a) && fs.existsSync(a)) || '';
}
function readImport(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { console.error('[UNIE-MUSO] lecture impossible', e); return ''; }
}
function deliverImport(text) {
  if (!text) return;
  if (win && !win.webContents.isLoading()) {
    win.webContents.executeJavaScript('window.onUnieImport && window.onUnieImport(' + JSON.stringify(text) + ')').catch(() => {});
  } else pendingImport = text;
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}
function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 380, minHeight: 500, title: 'UNIE-MUSO', backgroundColor: '#F6F7F9',
    icon: path.join(__dirname, 'icon.ico'), autoHideMenuBar: true, show: !process.argv.includes('--hidden'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.setMenuBarVisibility(false);
  win.loadURL('app://unie-muso/UNIE-MUSO.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: path.join(__dirname, 'icon.ico') } };
  });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault(); win.hide();
    if (!global.trayHintShown) {
      global.trayHintShown = true;
      new Notification({ title: 'UNIE-MUSO reste actif', body: 'Les rappels de réunion continuent. Clic droit sur l’icône UNIE-MUSO près de l’horloge pour quitter.' }).show();
    }
  });
}
function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'icon.ico'));
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('UNIE-MUSO');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Ouvrir UNIE-MUSO', click: showWindow },
    { label: 'Ouvrir le dossier des données', click: () => shell.openPath(dataDir()) },
    { type: 'separator' },
    { label: 'Quitter', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

/* ---------- Pont avec la page (appels synchrones simples) ---------- */
ipcMain.on('unie:saveData', (e, json) => {
  try { const f = DATA_FILE(); fs.writeFileSync(f + '.tmp', json, 'utf8'); fs.renameSync(f + '.tmp', f); e.returnValue = f; } catch (err) { e.returnValue = 'ERR:' + err.message; }
});
ipcMain.on('unie:loadData', (e) => { try { e.returnValue = fs.existsSync(DATA_FILE()) ? fs.readFileSync(DATA_FILE(), 'utf8') : ''; } catch (_err) { e.returnValue = ''; } });
ipcMain.on('unie:saveFile', (e, name, text) => {
  try {
    const safe = String(name).replace(/\.\.+/g, '.').replace(/[^\w.\-/]/g, '_');
    const f = path.join(dataDir(), safe); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text, 'utf8');
    e.returnValue = f;
  } catch (err) { e.returnValue = 'ERR:' + err.message; }
});
ipcMain.on('unie:shareFile', (e, name, text) => {
  try {
    const f = path.join(dataDir(), 'partage', path.basename(String(name)));
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text, 'utf8');
    shell.showItemInFolder(f);
    e.returnValue = f;
  } catch (err) { e.returnValue = 'ERR:' + err.message; }
});
ipcMain.on('unie:dataFolder', (e) => { e.returnValue = dataDir(); });
ipcMain.on('unie:openFolder', (e) => { shell.openPath(dataDir()); e.returnValue = true; });
ipcMain.on('unie:pending', (e) => { e.returnValue = pendingImport; pendingImport = ''; });
ipcMain.on('unie:notify', (e, title, body) => { try { new Notification({ title, body, icon: path.join(__dirname, 'icon.ico') }).show(); } catch (_err) { /* */ } e.returnValue = true; });
ipcMain.on('unie:alarms', (e, json) => {
  alarmTimers.forEach(clearTimeout); alarmTimers = [];
  try {
    JSON.parse(json || '[]').forEach((a) => {
      const delay = a.at - Date.now();
      if (delay > 0 && delay < 2147483647) {
        alarmTimers.push(setTimeout(() => {
          const n = new Notification({ title: a.title, body: a.body, icon: path.join(__dirname, 'icon.ico') });
          n.on('click', showWindow); n.show();
        }, delay));
      }
    });
  } catch (_err) { /* */ }
  e.returnValue = alarmTimers.length;
});

/* ---------- Cycle de vie ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    showWindow();
    const f = fileFromArgv(argv);
    if (f) deliverImport(readImport(f));
  });
  app.setAppUserModelId(APP_ID);
  app.whenReady().then(() => {
    const f = fileFromArgv(process.argv);
    if (f) pendingImport = readImport(f);
    dataDir();
    registerAppProtocol();
    createWindow();
    createTray();
    // Démarre (caché) à l'ouverture de session pour que les rappels de réunion fonctionnent
    try { app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] }); } catch (_e) { /* */ }
  }).catch((err) => { dialog.showErrorBox('UNIE-MUSO', String(err)); });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { /* reste dans la zone de notification */ });
}
