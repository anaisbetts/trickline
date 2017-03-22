import { app, BrowserWindow } from 'electron';
import { enableLiveReload } from 'electron-compile';
import * as electronDebug from 'electron-debug';
import installExtension from 'electron-devtools-installer';
import { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import { config } from 'dotenv';
import { initializeEvalHandler } from 'electron-remote';
import { startTracing, stopTracing } from './profiler';

config();

let mainWindow = null;
electronDebug({enabled: true});
enableLiveReload({strategy: 'react-hmr'});

const isDevMode = process.execPath.match(/[\\/]electron/);
const traceMode = process.env['TRICKLINE_HEAPSHOT_AND_BAIL'];

global.tracingControl = {
  startTracing,
  stopTracing: async (shouldExit = false) => {
    await stopTracing();
    if (shouldExit) app.quit();
  }
};

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', async () => {
  initializeEvalHandler();
  if (traceMode) await startTracing();

  mainWindow = new BrowserWindow({
    width: 1024, height: 768,
  });

  mainWindow.loadURL(`file://${__dirname}/index.html?react_perf`);

  if (traceMode) return;

  // Open the DevTools.
  if (isDevMode) {
    await installExtension(REACT_DEVELOPER_TOOLS);
    mainWindow.webContents.openDevTools();
  } else {
    if (!process.env.TRICKLINE_DONT_DEVTOOLS) mainWindow.webContents.openDevTools();
  }
});