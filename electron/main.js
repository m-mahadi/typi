const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const DEFAULT_VAULT_NAME = "Typi Vault";
const NOTES_FOLDER = "Typi Notes";

function getDefaultVaultPath() {
  return path.join(app.getPath("home"), "Documents", DEFAULT_VAULT_NAME);
}

function getConfigPath() {
  return path.join(app.getPath("appData"), "typi", "config.json");
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function createObsidianVault(vaultPath) {
  fs.mkdirSync(vaultPath, { recursive: true });
  fs.mkdirSync(path.join(vaultPath, NOTES_FOLDER), { recursive: true });

  const obsidianDir = path.join(vaultPath, ".obsidian");
  fs.mkdirSync(obsidianDir, { recursive: true });

  const obsidianFiles = {
    "app.json": { legacyEditor: false, livePreview: true },
    appearance: { theme: "moonstone" },
  };

  const writeIfMissing = (filePath, content) => {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    }
  };

  writeIfMissing(path.join(obsidianDir, "app.json"), obsidianFiles["app.json"]);
  writeIfMissing(path.join(obsidianDir, "appearance.json"), obsidianFiles.appearance);
  writeIfMissing(path.join(obsidianDir, "core-plugins.json"), [
    "file-explorer",
    "global-search",
    "switcher",
    "graph",
    "backlink",
    "page-preview",
    "daily-notes",
    "templates",
    "note-composer",
    "editor-status",
  ]);

  const welcomePath = path.join(vaultPath, "Welcome to Typi.md");
  if (!fs.existsSync(welcomePath)) {
    fs.writeFileSync(
      welcomePath,
      `# Welcome to Typi Vault

Notes saved from **Typi** are stored in \`${NOTES_FOLDER}/\`.

Open this folder in Obsidian: **Open folder as vault** and choose:

\`${vaultPath.replace(/\\/g, "/")}\`
`
    );
  }
}

function ensureDefaultVault() {
  const config = loadConfig();
  if (config.vaultPath) {
    createObsidianVault(config.vaultPath);
    return config.vaultPath;
  }

  const vaultPath = getDefaultVaultPath();
  createObsidianVault(vaultPath);
  config.vaultPath = vaultPath;
  saveConfig(config);
  return vaultPath;
}

function getVaultInfo() {
  const config = loadConfig();
  const vaultPath = config.vaultPath;
  const connected = Boolean(vaultPath && fs.existsSync(vaultPath));
  return {
    connected,
    path: connected ? vaultPath : null,
    name: connected ? path.basename(vaultPath) : null,
    notesFolder: NOTES_FOLDER,
  };
}

function setVaultPath(vaultPath) {
  createObsidianVault(vaultPath);
  const config = loadConfig();
  config.vaultPath = vaultPath;
  saveConfig(config);
  return getVaultInfo();
}

function saveNoteToVault(filename, markdown) {
  const info = getVaultInfo();
  if (!info.connected) {
    ensureDefaultVault();
  }

  const vaultPath = loadConfig().vaultPath;
  const notesDir = path.join(vaultPath, NOTES_FOLDER);
  fs.mkdirSync(notesDir, { recursive: true });

  const safeName = path.basename(filename);
  const filePath = path.join(notesDir, safeName);
  fs.writeFileSync(filePath, markdown, "utf8");

  return { ok: true, path: filePath, filename: safeName };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    minWidth: 720,
    minHeight: 640,
    title: "Typi",
    autoHideMenuBar: true,
    backgroundColor: "#0c0a08",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "..", "index.html"));
}

app.whenReady().then(() => {
  ensureDefaultVault();

  ipcMain.handle("vault:info", () => getVaultInfo());

  ipcMain.handle("vault:pick", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Obsidian vault folder",
      defaultPath: path.join(app.getPath("home"), "Documents"),
    });
    if (result.canceled || !result.filePaths[0]) {
      return getVaultInfo();
    }
    return setVaultPath(result.filePaths[0]);
  });

  ipcMain.handle("vault:save", (_event, { filename, markdown }) => {
    try {
      return saveNoteToVault(filename, markdown);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
