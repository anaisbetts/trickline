import {app, BrowserWindow } from 'electron';
import electronDebug from 'electron-debug';

let mainWindow = null;
electronDebug();

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 580,
    height: 365
  });
  
  mainWindow.loadURL(`file://${__dirname}/src/index.html`);
});
