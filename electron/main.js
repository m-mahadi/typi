const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");

const DEFAULT_VAULT_NAME = "Typi Vault";
const NOTES_FOLDER = "Typi Notes";
const OBSIDIAN_DOWNLOAD_URL = "https://obsidian.md/download";
const OBSIDIAN_LATEST_RELEASE_API = "https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest";

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

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "Typi",
          Accept: "application/vnd.github+json",
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          requestJson(response.headers.location).then(resolve, reject);
          return;
        }

        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    request.on("error", reject);
  });
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(destination, () => {});
        response.resume();
        downloadFile(response.headers.location, destination).then(resolve, reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        file.close();
        fs.unlink(destination, () => {});
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    });

    request.on("error", (error) => {
      file.close();
      fs.unlink(destination, () => {});
      reject(error);
    });
  });
}

async function getLatestObsidianInstallerUrl() {
  const release = await requestJson(OBSIDIAN_LATEST_RELEASE_API);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const windowsAsset = assets.find((asset) => /^Obsidian[-.].*\.exe$/i.test(asset.name || ""));
  if (!windowsAsset?.browser_download_url) {
    throw new Error("Could not find the Obsidian Windows installer.");
  }
  return windowsAsset.browser_download_url;
}

function waitForObsidianInstall(timeoutMs = 45000) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const obsidianExe = findObsidianExe();
      if (obsidianExe || Date.now() - startedAt > timeoutMs) {
        resolve(obsidianExe);
        return;
      }
      setTimeout(tick, 1500);
    };
    tick();
  });
}

async function installObsidianFromOfficialInstaller() {
  const downloadUrl = await getLatestObsidianInstallerUrl();
  const installerPath = path.join(app.getPath("temp"), path.basename(new URL(downloadUrl).pathname));
  await downloadFile(downloadUrl, installerPath);

  return new Promise((resolve) => {
    const child = spawn(installerPath, [], { detached: false, windowsHide: false });
    child.on("error", (error) => resolve({ ok: false, error: error.message }));
    child.on("close", async () => {
      const obsidianExe = await waitForObsidianInstall();
      resolve({ ok: Boolean(obsidianExe), path: obsidianExe, installerPath });
    });
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
    await dialog.showMessageBox({
      type: "info",
      buttons: ["OK"],
      title: "Installing Obsidian",
      message: "Typi will download and open the official Obsidian Windows installer.",
      detail: "Finish the Obsidian installer when it appears. Typi will continue after that.",
    });
    let installResult = { ok: false };
    try {
      installResult = await installObsidianFromOfficialInstaller();
    } catch (err) {
      installResult = { ok: false, error: err.message };
    }
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
      message: "Typi could not finish the Obsidian installer automatically.",
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

function getObsidianConfigPath() {
  return path.join(app.getPath("appData"), "Obsidian", "obsidian.json");
}

function registerVaultWithObsidian(vaultPath) {
  const configPath = getObsidianConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  let config = { vaults: {} };
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    config = { vaults: {} };
  }
  if (!config.vaults || typeof config.vaults !== "object") {
    config.vaults = {};
  }

  let vaultId = Object.keys(config.vaults).find((key) => config.vaults[key]?.path === vaultPath);
  for (const vault of Object.values(config.vaults)) {
    if (vault && typeof vault === "object" && Object.hasOwn(vault, "open")) {
      vault.open = false;
    }
  }

  if (!vaultId) {
    vaultId = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
    config.vaults[vaultId] = { path: vaultPath, ts: Date.now(), open: true };
  } else {
    config.vaults[vaultId].ts = Date.now();
    config.vaults[vaultId].open = true;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  return vaultId;
}

function getObsidianTargetPath(vaultPath, filename) {
  if (filename) {
    return path.join(vaultPath, NOTES_FOLDER, path.basename(filename));
  }
  return path.join(vaultPath, "Welcome to Typi.md");
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
    let installResult = { ok: false };
    try {
      installResult = await installObsidianFromOfficialInstaller();
    } catch (err) {
      installResult = { ok: false, error: err.message };
    }
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

async function openVaultInObsidian(filename) {
  const vaultPath = ensureDefaultVault();
  let obsidianExe = findObsidianExe();
  if (!obsidianExe) {
    obsidianExe = await askToInstallObsidianForOpen();
  }
  if (!obsidianExe) {
    return { ok: false, error: "Obsidian is not installed." };
  }

  registerVaultWithObsidian(vaultPath);
  const targetPath = getObsidianTargetPath(vaultPath, filename);
  await shell.openExternal(`obsidian://open?path=${encodeURIComponent(targetPath)}`);
  return { ok: true, path: targetPath };
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

app.whenReady().then(async () => {
  ensureDefaultVault();
  await promptForObsidianIfMissing();

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

  ipcMain.handle("vault:open-obsidian", async (_event, { filename } = {}) => {
    try {
      return await openVaultInObsidian(filename);
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
