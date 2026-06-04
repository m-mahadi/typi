const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_VAULT_NAME = "Typi Vault";
const NOTES_FOLDER = "Typi Notes";
const OBSIDIAN_DOWNLOAD_URL = "https://obsidian.md/download";

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

function findObsidianExe() {
  const candidates = [
    path.join(app.getPath("home"), "AppData", "Local", "Programs", "Obsidian", "Obsidian.exe"),
    path.join(app.getPath("home"), "AppData", "Local", "Obsidian", "Obsidian.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Obsidian", "Obsidian.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Obsidian", "Obsidian.exe"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function installObsidianWithWinget() {
  return new Promise((resolve) => {
    const child = spawn(
      "winget",
      ["install", "--id", "Obsidian.Obsidian", "--exact", "--source", "winget", "--accept-package-agreements", "--accept-source-agreements"],
      { windowsHide: false }
    );

    child.on("error", (error) => resolve({ ok: false, error: error.message }));
    child.on("close", (code) => resolve({ ok: code === 0, code }));
  });
}

async function promptForObsidianIfMissing() {
  const config = loadConfig();
  if (findObsidianExe() || config.obsidianPromptedAt) {
    return;
  }

  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["Install Obsidian", "Open download page", "Skip for now"],
    defaultId: 0,
    cancelId: 2,
    title: "Install Obsidian",
    message: "Typi saves notes as Markdown files for Obsidian.",
    detail: "Typi still works without Obsidian because it saves plain Markdown files. Obsidian is recommended so you can easily browse, open, and organize your Typi notes.",
  });

  config.obsidianPromptedAt = new Date().toISOString();
  saveConfig(config);

  if (result.response === 0) {
    const installResult = await installObsidianWithWinget();
    if (installResult.ok || findObsidianExe()) {
      await dialog.showMessageBox({
        type: "info",
        buttons: ["OK"],
        title: "Obsidian installed",
        message: "Obsidian is installed.",
        detail: "Open the Typi Vault folder as a vault in Obsidian.",
      });
      return;
    }

    await dialog.showMessageBox({
      type: "warning",
      buttons: ["Open download page"],
      title: "Could not install Obsidian automatically",
      message: "Typi could not install Obsidian with Windows Package Manager.",
      detail: "The official Obsidian download page will open instead.",
    });
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
  } else if (result.response === 1) {
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
  } else {
    await dialog.showMessageBox({
      type: "warning",
      buttons: ["OK"],
      title: "Obsidian skipped",
      message: "Typi will still save your notes.",
      detail: "They will be plain Markdown files in your Typi Vault. Install Obsidian later if you want an easy app for browsing and organizing them.",
    });
  }
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

async function askToInstallObsidianForOpen() {
  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["Install Obsidian", "Open download page", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Open Typi Vault in Obsidian",
    message: "Obsidian is not installed yet.",
    detail: "Typi can still save Markdown files, but Obsidian makes the Typi Vault easy to browse.",
  });

  if (result.response === 0) {
    const installResult = await installObsidianWithWinget();
    if (installResult.ok || findObsidianExe()) {
      return findObsidianExe();
    }
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
    return null;
  }

  if (result.response === 1) {
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
  }

  return null;
}

async function openVaultInObsidian() {
  const vaultPath = ensureDefaultVault();
  let obsidianExe = findObsidianExe();
  if (!obsidianExe) {
    obsidianExe = await askToInstallObsidianForOpen();
  }
  if (!obsidianExe) {
    return { ok: false, error: "Obsidian is not installed." };
  }

  const child = spawn(obsidianExe, [vaultPath], { detached: true, stdio: "ignore" });
  child.unref();
  return { ok: true, path: vaultPath };
}

async function showNotesFolder() {
  const vaultPath = ensureDefaultVault();
  const notesDir = path.join(vaultPath, NOTES_FOLDER);
  fs.mkdirSync(notesDir, { recursive: true });
  const error = await shell.openPath(notesDir);
  return error ? { ok: false, error } : { ok: true, path: notesDir };
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
  promptForObsidianIfMissing();

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

  ipcMain.handle("vault:open-obsidian", async () => {
    try {
      return await openVaultInObsidian();
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("vault:show-notes", async () => {
    try {
      return await showNotesFolder();
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
