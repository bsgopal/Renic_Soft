const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let devServerProcess;

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    backgroundColor: '#1e1b4b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const load = () => mainWindow.loadURL(url);

  // Show as soon as the renderer paints (no blank window, feels instant)
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  // Safety: force-show after 6s so the user is never left with an invisible window
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  }, 6000);

  // If the page fails to load (backend still starting), retry
  mainWindow.webContents.on('did-fail-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) setTimeout(load, 1200);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  load();
}

function startDevServers() {
  devServerProcess = spawn('npm', ['run', 'dev'], { cwd: __dirname, shell: true });
  devServerProcess.stdout.on('data', (data) => console.log(`[DevServer]: ${data}`));
  devServerProcess.stderr.on('data', (data) => console.error(`[DevServer Error]: ${data}`));
}

// Production: run Express inside the main process, wait until a port is actually
// bound (surviving any collisions), then load the UI from that exact port.
function startProduction() {
  try {
    let backendDir = path.join(__dirname, 'backend');
    if (backendDir.includes('app.asar')) backendDir = backendDir.replace('app.asar', 'app.asar.unpacked');
    process.chdir(backendDir);

    let serverPath = path.resolve(__dirname, 'backend/src/server.js');
    if (serverPath.includes('app.asar')) serverPath = serverPath.replace('app.asar', 'app.asar.unpacked');
    const serverUrl = 'file://' + serverPath.replace(/\\/g, '/');

    import(serverUrl)
      .then((mod) => {
        const { portState } = mod;
        const startedAt = Date.now();
        const waitMs = 30000;
        const poll = setInterval(() => {
          if (portState.ready || Date.now() - startedAt > waitMs) {
            clearInterval(poll);
            if (portState.ready) {
              createWindow(`http://localhost:${portState.port}`);
            } else {
              dialog.showErrorBox('Backend Startup', 'Backend server did not start within 30 seconds.');
            }
          }
        }, 100);
      })
      .catch((err) => {
        dialog.showErrorBox('Backend Startup Error', err.stack || err.message || String(err));
      });
  } catch (error) {
    dialog.showErrorBox('Backend Startup Error', error.stack || error.message || String(error));
  }
}

app.on('ready', () => {
  if (isDev) {
    startDevServers();
    setTimeout(() => createWindow('http://localhost:5173'), 2500);
  } else {
    startProduction();
  }
});

app.on('window-all-closed', () => {
  if (devServerProcess) devServerProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow(isDev ? 'http://localhost:5173' : 'http://localhost:5001');
});