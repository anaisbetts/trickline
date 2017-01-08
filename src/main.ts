import {app, BrowserWindow } from 'electron';
import * as electronDebug from 'electron-debug';
import installExtension from 'electron-devtools-installer';
import { VUEJS_DEVTOOLS } from 'electron-devtools-installer';

let mainWindow = null;
electronDebug({enabled: true});

const isDevMode = process.execPath.match(/[\\/]electron/);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', async () => {
  mainWindow = new BrowserWindow({
    width: 800, height:600 
  });

  mainWindow.loadURL(`file://${__dirname}/index.jade`);

  // Open the DevTools.
  if (isDevMode) {
    await installExtension(VUEJS_DEVTOOLS);
    mainWindow.webContents.openDevTools();
  } 
});