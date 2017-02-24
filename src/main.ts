import { app, BrowserWindow } from 'electron';
import { enableLiveReload } from 'electron-compile';
import * as electronDebug from 'electron-debug';
import installExtension from 'electron-devtools-installer';
import { REACT_DEVELOPER_TOOLS } from 'electron-devtools-installer';
import { config } from 'dotenv';

config();

let mainWindow = null;
electronDebug({enabled: true});
enableLiveReload({strategy: 'react-hmr'});

const isDevMode = process.execPath.match(/[\\/]electron/);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', async () => {
  mainWindow = new BrowserWindow({
    width: 800, height: 600,
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  if (isDevMode) {
    await installExtension(REACT_DEVELOPER_TOOLS);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.webContents.openDevTools();
  }
});