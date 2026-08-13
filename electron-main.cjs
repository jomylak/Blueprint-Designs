const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Load the built app directly from disk - no dev server / hosting required.
  // Run `npm run build` first (or use `npm run electron`, which does this for you).
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

// Native "Save As" dialog so the user can pick/create a folder and filename themselves,
// instead of everything landing silently in the browser's Downloads folder.
ipcMain.handle('save-file', async (event, { defaultName, base64Data, filters }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: defaultName,
    filters: filters && filters.length ? filters : [{ name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  return { canceled: false, filePath };
});

// Native "Open" dialog, paired with save-file above.
ipcMain.handle('open-file', async (event, { filters }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters && filters.length ? filters : [{ name: 'All Files', extensions: ['*'] }],
  });
  if (canceled || filePaths.length === 0) return { canceled: true };
  const data = fs.readFileSync(filePaths[0]);
  return { canceled: false, filePath: filePaths[0], base64Data: data.toString('base64') };
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
