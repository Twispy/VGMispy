const { app, BrowserWindow, ipcMain, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');

// Fix Windows GPU cache lock errors
app.commandLine.appendSwitch('disk-cache-dir', path.join(app.getPath('temp'), 'vgm-vinyl-cache'));
app.commandLine.appendSwitch('gpu-cache-dir', path.join(app.getPath('temp'), 'vgm-vinyl-gpu-cache'));

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 1340,
    minWidth: 540,
    minHeight: 960,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0a0f',
    title: 'VGM Vinyl Creator',
    autoHideMenuBar: true,
  });

  // Clear HTTP cache only (not storage, to preserve saved credentials)
  mainWindow.webContents.session.clearCache();

  // Dev or production
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Log any renderer crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Main] Renderer process gone:', details.reason, details.exitCode);
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Main] Page failed to load:', errorCode, errorDescription);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC: Save dialog for export ───
ipcMain.handle('dialog:save', async (event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Video',
    defaultPath: defaultName || 'vgm-vinyl-export.webm',
    filters: [
      { name: 'WebM Video', extensions: ['webm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  return result.filePath || null;
});

// ─── IPC: Write blob to file ───
ipcMain.handle('file:writeBlob', async (event, filePath, arrayBuffer) => {
  try {
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Open file dialog for media ───
ipcMain.handle('dialog:openFile', async (event, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select File',
    filters: filters || [
      { name: 'Media', extensions: ['mp3', 'wav', 'ogg', 'flac', 'mp4', 'webm', 'jpg', 'jpeg', 'png', 'webp'] },
    ],
    properties: ['openFile'],
  });
  return result.filePaths[0] || null;
});

// ─── IPC: Read file as buffer ───
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: buffer, name: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Save dialog with format choice ───
ipcMain.handle('dialog:saveExport', async (event, defaultName, format) => {
  const filters = format === 'mp4'
    ? [{ name: 'MP4 Video', extensions: ['mp4'] }]
    : [{ name: 'WebM Video', extensions: ['webm'] }];

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Video',
    defaultPath: defaultName,
    filters,
  });
  return result.filePath || null;
});

// ─── IPC: Convert WebM to MP4 via FFmpeg ───
ipcMain.handle('ffmpeg:convert', async (event, webmPath, mp4Path) => {
  try {
    // In packaged app, FFmpeg is in extraResources. In dev, use ffmpeg-static.
    let ffmpegPath;
    if (app.isPackaged) {
      ffmpegPath = path.join(process.resourcesPath, 'ffmpeg.exe');
    } else {
      ffmpegPath = require('ffmpeg-static');
    }
    const { execFile } = require('child_process');

    console.log('FFmpeg path:', ffmpegPath);

    return new Promise((resolve) => {
      const args = [
        '-y',                    // overwrite
        '-i', webmPath,          // input
        '-c:v', 'libx264',      // H.264 video codec
        '-preset', 'medium',    // good balance speed/quality
        '-crf', '17',           // quality (17 = very good)
        '-pix_fmt', 'yuv420p',  // compatibility with all players
        '-r', '60',             // force constant 60fps output
        '-vsync', 'cfr',        // constant frame rate (no VFR saccades)
        '-c:a', 'aac',          // AAC audio codec
        '-b:a', '256k',         // audio bitrate
        '-movflags', '+faststart', // web-optimized MP4
        mp4Path,                // output
      ];

      const proc = execFile(ffmpegPath, args, { timeout: 300000 }, (err) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          // Clean up temp WebM
          try { fs.unlinkSync(webmPath); } catch (e) {}
          resolve({ success: true, path: mp4Path });
        }
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Get temp dir path ───
ipcMain.handle('app:getTempDir', async () => {
  return app.getPath('temp');
});

// ─── IPC: Save thumbnail (PNG) ───
ipcMain.handle('thumbnail:save', async (event, arrayBuffer) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Thumbnail',
    defaultPath: 'vgm-thumbnail.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return { success: false };
  try {
    fs.writeFileSync(result.filePath, Buffer.from(arrayBuffer));
    return { success: true, path: result.filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ─── IPC: Save project (.json) ───
ipcMain.handle('project:save', async (event, projectData) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: 'vgm-project.json',
    filters: [{ name: 'VGM Project', extensions: ['json'] }],
  });
  if (!result.filePath) return { success: false, error: 'Cancelled' };
  try {
    fs.writeFileSync(result.filePath, JSON.stringify(projectData, null, 2));
    // Save to recent projects
    saveRecentProject(result.filePath, projectData.config?.trackTitle || 'Untitled');
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Load project (.json) ───
ipcMain.handle('project:load', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Project',
    filters: [{ name: 'VGM Project', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!result.filePaths[0]) return { success: false, error: 'Cancelled' };
  try {
    const data = fs.readFileSync(result.filePaths[0], 'utf-8');
    return { success: true, data: JSON.parse(data), path: result.filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Recent projects management ───
const RECENT_FILE = path.join(app.getPath('userData'), 'recent-projects.json');

function saveRecentProject(filePath, title) {
  let recent = loadRecentProjects();
  // Remove duplicate
  recent = recent.filter(r => r.path !== filePath);
  // Add to front
  recent.unshift({ path: filePath, title, date: new Date().toISOString() });
  // Keep max 10
  recent = recent.slice(0, 10);
  try { fs.writeFileSync(RECENT_FILE, JSON.stringify(recent)); } catch (e) {}
}

function loadRecentProjects() {
  try {
    return JSON.parse(fs.readFileSync(RECENT_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

ipcMain.handle('project:getRecent', async () => {
  return loadRecentProjects();
});

ipcMain.handle('project:loadFromPath', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: JSON.parse(data), path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ═══════════════════════════════════════════
// API PROXY — runs in main process to avoid CORS
// ═══════════════════════════════════════════

// ─── Shared HTTPS GET helper (IPv4, redirect follow) ───
function httpsGet(url, redirects = 0) {
  const https = require('https');
  const dns   = require('dns');
  return new Promise((resolve) => {
    if (redirects > 5) return resolve({ success: false, error: 'Too many redirects' });
    const req = https.get(url, {
      headers: { 'User-Agent': 'VGMVinylCreator/1.0.0 (vgm-vinyl-creator)', 'Accept': 'application/json' },
      lookup: (hostname, opts, cb) => dns.lookup(hostname, { family: 4 }, cb),
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return httpsGet(res.headers.location, redirects + 1).then(resolve);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return resolve({ success: false, error: `Erreur serveur (${res.statusCode}) — vgmdb.info indisponible, réessaie dans quelques instants.` });
        }
        try { resolve({ success: true, data: JSON.parse(data) }); }
        catch (e) { resolve({ success: false, error: `Parse error (${res.statusCode}): ${e.message}` }); }
      });
    });
    req.on('error', (e) => resolve({ success: false, error: e.message }));
  });
}

let igdbToken = null;
let igdbTokenExpiry = 0;

// ─── IGDB: Get OAuth token ───
async function getIgdbToken(clientId, clientSecret) {
  const now = Date.now();
  if (igdbToken && now < igdbTokenExpiry) return igdbToken;

  const https = require('https');
  return new Promise((resolve, reject) => {
    const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
    const req = https.request(url, { method: 'POST' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          igdbToken = json.access_token;
          igdbTokenExpiry = now + (json.expires_in || 3600) * 1000;
          resolve(igdbToken);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── IGDB: Search games ───
ipcMain.handle('api:searchGame', async (event, query, clientId, clientSecret) => {
  try {
    const token = await getIgdbToken(clientId, clientSecret);
    const https = require('https');

    return new Promise((resolve) => {
      const body = `search "${query}"; fields name,first_release_date,involved_companies.company.name,involved_companies.developer,cover.image_id,platforms.abbreviation,genres.name; limit 20;`;

      const req = https.request('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ success: true, data: JSON.parse(data) });
          } catch (e) {
            resolve({ success: false, error: 'Parse error: ' + e.message });
          }
        });
      });
      req.on('error', (e) => resolve({ success: false, error: e.message }));
      req.write(body);
      req.end();
    });
  } catch (e) {
    igdbToken = null; // reset token on error
    return { success: false, error: e.message };
  }
});

