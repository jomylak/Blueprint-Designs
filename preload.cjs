const { contextBridge, ipcRenderer } = require('electron');

// Exposed to the renderer as window.electronAPI. Kept deliberately narrow (just save/open
// file dialogs) since contextIsolation/nodeIntegration are locked down in electron-main.cjs.
contextBridge.exposeInMainWorld('electronAPI', {
  saveFile: (defaultName, base64Data, filters) =>
    ipcRenderer.invoke('save-file', { defaultName, base64Data, filters }),
  openFile: (filters) =>
    ipcRenderer.invoke('open-file', { filters }),
});
