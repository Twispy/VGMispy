const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialogs
  saveDialog: (defaultName) => ipcRenderer.invoke('dialog:save', defaultName),
  saveExportDialog: (defaultName, format) => ipcRenderer.invoke('dialog:saveExport', defaultName, format),
  openFileDialog: (filters) => ipcRenderer.invoke('dialog:openFile', filters),

  // File operations
  writeBlob: (filePath, arrayBuffer) => ipcRenderer.invoke('file:writeBlob', filePath, arrayBuffer),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),

  // FFmpeg
  convertToMp4: (webmPath, mp4Path) => ipcRenderer.invoke('ffmpeg:convert', webmPath, mp4Path),
  getTempDir: () => ipcRenderer.invoke('app:getTempDir'),

  // Projects
  saveProject: (data) => ipcRenderer.invoke('project:save', data),
  loadProject: () => ipcRenderer.invoke('project:load'),
  getRecentProjects: () => ipcRenderer.invoke('project:getRecent'),
  loadProjectFromPath: (path) => ipcRenderer.invoke('project:loadFromPath', path),

  // API proxy (runs in main process to avoid CORS)
  searchGame: (query, clientId, clientSecret) => ipcRenderer.invoke('api:searchGame', query, clientId, clientSecret),
  searchMusic: (query) => ipcRenderer.invoke('api:searchMusic', query),
  getAlbumDetails: (albumLink) => ipcRenderer.invoke('api:getAlbumDetails', albumLink),

  // Thumbnail
  saveThumbnail: (arrayBuffer) => ipcRenderer.invoke('thumbnail:save', arrayBuffer),

  // Check if running in Electron
  isElectron: true,
});
