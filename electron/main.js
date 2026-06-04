const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const https = require("https");
const path = require("path");

const DEFAULT_VAULT_NAME = "Typi Vault";
const NOTES_FOLDER = "Typi Notes";
const OBSIDIAN_DOWNLOAD_URL = "https://obsidian.md/download";
const OBSIDIAN_LATEST_RELEASE_API = "https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest";
const OBSIDIAN_PROMPT_VERSION = 2;

function getDefaultVaultPath() {
  return path.join(app.getPath("documents"), DEFAULT_VAULT_NAME);
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
  const localAppData =
    process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local");
  const candidates = [
    path.join(localAppData, "Programs", "Obsidian", "Obsidian.exe"),
    path.join(localAppData, "Obsidian", "Obsidian.exe"),
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
    const request = https.get(
      url,
      { headers: { "User-Agent": "Typi" } },
      (response) => {
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
      }
    );

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

function markObsidianPrompted() {
  const config = loadConfig();
  config.obsidianPromptedAt = new Date().toISOString();
  config.obsidianPromptVersion = OBSIDIAN_PROMPT_VERSION;
  saveConfig(config);
}

async function launchObsidianInstaller(installerPath) {
  const openError = await shell.openPath(installerPath);
  if (!openError) {
    return { ok: true };
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(installerPath, [], {
        detached: true,
        windowsHide: false,
        stdio: "ignore",
      });
      child.on("error", (error) => resolve({ ok: false, error: error.message }));
      child.unref();
      resolve({ ok: true });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

async function promptObsidianInstallContinue() {
  while (true) {
    const continueResult = await dialog.showMessageBox({
      type: "info",
      buttons: ["Continue", "Open download page", "Skip"],
      defaultId: 0,
      cancelId: 2,
      title: "Install Obsidian",
      message: "Finish the Obsidian installer, then press Continue.",
      detail: "If the installer is still running, finish it first. If the installer did not appear, use Open download page or Skip.",
    });

    if (continueResult.response === 1) {
      await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
      return { installed: false };
    }

    if (continueResult.response === 2) {
      return { installed: false, skipped: true };
    }

    const obsidianExe = findObsidianExe();
    if (obsidianExe) {
      const vaultPath = ensureDefaultVault();
      registerVaultWithObsidian(vaultPath);
      await dialog.showMessageBox({
        type: "info",
        buttons: ["OK"],
        title: "Obsidian installed",
        message: "Obsidian is installed.",
        detail: "Typi registered your vault in Obsidian.",
      });
      return { installed: true, path: obsidianExe };
    }

    const retryResult = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Check again", "Open download page", "Skip"],
      defaultId: 0,
      cancelId: 2,
      title: "Obsidian not found yet",
      message: "Typi could not find Obsidian on this PC yet.",
      detail: "If the installer is still open, finish it and choose Check again.",
    });

    if (retryResult.response === 1) {
      await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
      return { installed: false };
    }

    if (retryResult.response === 2) {
      return { installed: false, skipped: true };
    }
  }
}

async function runObsidianInstallerFlow() {
  let launchResult = { ok: false };
  try {
    const downloadUrl = await getLatestObsidianInstallerUrl();
    const installerPath = path.join(
      app.getPath("temp"),
      path.basename(new URL(downloadUrl).pathname)
    );
    await downloadFile(downloadUrl, installerPath);
    launchResult = await launchObsidianInstaller(installerPath);
  } catch (err) {
    launchResult = { ok: false, error: err.message };
  }

  if (!launchResult.ok) {
    await dialog.showMessageBox({
      type: "warning",
      buttons: ["Open download page"],
      title: "Could not start Obsidian installer",
      message: "Typi could not download or open the Obsidian installer.",
      detail: launchResult.error || "The official Obsidian download page will open instead.",
    });
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
    return { installed: false };
  }

  return promptObsidianInstallContinue();
}

async function promptForObsidianIfMissing() {
  const config = loadConfig();
  if (findObsidianExe() || config.obsidianPromptVersion >= OBSIDIAN_PROMPT_VERSION) {
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

  if (result.response === 0) {
    const flowResult = await runObsidianInstallerFlow();
    if (flowResult.installed || flowResult.skipped) {
      markObsidianPrompted();
    }
    return;
  }

  markObsidianPrompted();

  if (result.response === 1) {
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
    return;
  }

  await dialog.showMessageBox({
    type: "warning",
    buttons: ["OK"],
    title: "Obsidian skipped",
    message: "Typi will still save your notes.",
    detail: "They will be plain Markdown files in your Typi Vault. Install Obsidian later if you want an easy app for browsing and organizing them.",
  });
}

function normalizeVaultPath(vaultPath) {
  if (!vaultPath || typeof vaultPath !== "string") {
    return "";
  }
  const resolved = path.resolve(vaultPath.trim());
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function canonicalVaultPath(vaultPath) {
  return path.resolve(String(vaultPath).trim());
}

function getVaultPathFromConfig() {
  const config = loadConfig();
  if (!config.vaultPath) {
    return null;
  }
  return canonicalVaultPath(config.vaultPath);
}

function ensureVaultFiles(vaultPath) {
  return createObsidianVault(vaultPath);
}

function createObsidianVault(vaultPath) {
  const canonical = canonicalVaultPath(vaultPath);
  fs.mkdirSync(canonical, { recursive: true });
  fs.mkdirSync(path.join(canonical, NOTES_FOLDER), { recursive: true });

  const obsidianDir = path.join(canonical, ".obsidian");
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

  const welcomePath = path.join(canonical, "Welcome to Typi.md");
  if (!fs.existsSync(welcomePath)) {
    fs.writeFileSync(
      welcomePath,
      `# Welcome to Typi Vault

Notes saved from **Typi** are stored in \`${NOTES_FOLDER}/\`.

Open this folder in Obsidian: **Open folder as vault** and choose:

\`${canonical.replace(/\\/g, "/")}\`
`
    );
  }

  return canonical;
}

function ensureDefaultVault() {
  const config = loadConfig();
  const configured = getVaultPathFromConfig();

  if (configured) {
    const canonical = ensureVaultFiles(configured);
    if (config.vaultPath !== canonical) {
      config.vaultPath = canonical;
      saveConfig(config);
    }
    return canonical;
  }

  const vaultPath = canonicalVaultPath(getDefaultVaultPath());
  ensureVaultFiles(vaultPath);
  config.vaultPath = vaultPath;
  saveConfig(config);
  return vaultPath;
}

function getVaultInfo() {
  const config = loadConfig();
  const vaultPath = config.vaultPath ? canonicalVaultPath(config.vaultPath) : null;
  const connected = Boolean(vaultPath && fs.existsSync(vaultPath));
  return {
    connected,
    path: vaultPath,
    name: vaultPath ? path.basename(vaultPath) : null,
    notesFolder: NOTES_FOLDER,
  };
}

function setVaultPath(vaultPath) {
  const canonical = ensureVaultFiles(vaultPath);
  const config = loadConfig();
  config.vaultPath = canonical;
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
  const canonical = canonicalVaultPath(vaultPath);
  const normalizedCanonical = normalizeVaultPath(canonical);
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

  let vaultId = Object.keys(config.vaults).find((key) => {
    const existingPath = config.vaults[key]?.path;
    return existingPath && normalizeVaultPath(existingPath) === normalizedCanonical;
  });

  for (const vault of Object.values(config.vaults)) {
    if (vault && typeof vault === "object" && Object.hasOwn(vault, "open")) {
      vault.open = false;
    }
  }

  if (!vaultId) {
    vaultId = `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
    config.vaults[vaultId] = { path: canonical, ts: Date.now(), open: true };
  } else {
    config.vaults[vaultId].path = canonical;
    config.vaults[vaultId].ts = Date.now();
    config.vaults[vaultId].open = true;
  }

  const tempPath = `${configPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2), "utf8");
  fs.renameSync(tempPath, configPath);
  return vaultId;
}

function getObsidianTargetPath(vaultPath, filename) {
  const welcomePath = path.join(vaultPath, "Welcome to Typi.md");
  if (filename) {
    const notePath = path.join(vaultPath, NOTES_FOLDER, path.basename(filename));
    if (fs.existsSync(notePath)) {
      return notePath;
    }
  }
  return welcomePath;
}

function launchObsidianWithVault(obsidianExe, vaultPath) {
  return new Promise((resolve) => {
    try {
      const child = spawn(obsidianExe, [vaultPath], {
        detached: true,
        windowsHide: false,
        stdio: "ignore",
      });
      child.on("error", (error) => resolve({ ok: false, error: error.message }));
      child.unref();
      resolve({ ok: true });
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

function openObsidianUri(targetPath) {
  const uri = `obsidian://open?path=${encodeURIComponent(targetPath)}`;
  shell.openExternal(uri).catch(() => {});
}

async function promptObsidianMissingForOpen() {
  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["Open download page", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    title: "Open Typi Vault in Obsidian",
    message: "Obsidian is not installed yet.",
    detail: "Typi still saves Markdown files. Open the official download page?",
  });

  if (result.response === 0) {
    await shell.openExternal(OBSIDIAN_DOWNLOAD_URL);
  }
}

async function openVaultInObsidian(filename) {
  const vaultPath = ensureDefaultVault();
  const obsidianExe = findObsidianExe();
  if (!obsidianExe) {
    await promptObsidianMissingForOpen();
    return { ok: false, error: "Obsidian is not installed." };
  }

  registerVaultWithObsidian(vaultPath);
  const targetPath = getObsidianTargetPath(vaultPath, filename);
  const launchResult = await launchObsidianWithVault(obsidianExe, vaultPath);
  if (!launchResult.ok) {
    return { ok: false, error: "Typi Vault folder could not be opened." };
  }

  setTimeout(() => openObsidianUri(targetPath), 1000);
  return { ok: true, path: targetPath };
}

async function showNotesFolder() {
  const vaultPath = ensureDefaultVault();
  const notesDir = path.join(vaultPath, NOTES_FOLDER);
  fs.mkdirSync(notesDir, { recursive: true });
  const error = await shell.openPath(notesDir);
  if (error) {
    return { ok: false, error: "Typi Notes folder could not be opened." };
  }
  return { ok: true, path: notesDir };
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
  await promptForObsidianIfMissing();
  ensureDefaultVault();

  ipcMain.handle("vault:info", () => getVaultInfo());

  ipcMain.handle("vault:pick", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose Obsidian vault folder",
      defaultPath: app.getPath("documents"),
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
