const STORAGE_KEY = "typewriter-desk-draft";
const VAULT_HANDLE_KEY = "typewriter-desk-vault";
const SOUND_KEY = "typewriter-desk-sound";
const NOTES_FOLDER = "Typi Notes";
const AUTOSAVE_DELAY = 1400;

const editor = document.getElementById("editor");
const titleInput = document.getElementById("note-title");
const wordCountEl = document.getElementById("word-count");
const saveStatusEl = document.getElementById("save-status");
const vaultLamp = document.getElementById("vault-lamp");
const toastEl = document.getElementById("toast");
const typebar = document.getElementById("typebar");
const carriageBlock = document.getElementById("carriage-block");
const writingWell = document.getElementById("writing-well");
const soundLamp = document.getElementById("sound-lamp");

const btnVault = document.getElementById("btn-vault");
const btnOpenObsidian = document.getElementById("btn-open-obsidian");
const btnShowNotes = document.getElementById("btn-show-notes");
const btnNew = document.getElementById("btn-new");
const btnSound = document.getElementById("btn-sound");
const btnSave = document.getElementById("btn-save");

const CHAR_WIDTH = 8.1;
const LINES_PER_PAGE = 66;
const CHARS_PER_LINE = 78;
const MAX_STRIKE_X = 500;

const isElectron = typeof window.typi !== "undefined";

const storedSound = localStorage.getItem(SOUND_KEY);
let soundEnabled = storedSound === null ? true : storedSound === "true";
let saveTimer = null;
let vaultSaveTimer = null;
let toastTimer = null;
let audioWarm = false;
let activeFilename = null;
let activeCreatedAt = null;
let lastVaultFingerprint = "";

const SOUND_FILES = {
  key: ["sounds/key-strike.wav", "sounds/key-strike-alt.wav", "sounds/key-strike-3.wav"],
  space: ["sounds/space-bar.wav"],
  backspace: ["sounds/backspace.wav"],
  carriage: ["sounds/carriage-return.wav"],
  bell: ["sounds/bell.wav"],
};

function showToast(message, duration = 3200) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function countLines(text) {
  if (!text) return 1;
  return text.split("\n").length;
}

function updateWordCount() {
  const words = countWords(editor.value);
  const lines = countLines(editor.value);
  const totalPages = Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
  const cursorLine = editor.value.slice(0, editor.selectionStart).split("\n").length;
  const cursorPage = Math.max(1, Math.ceil(cursorLine / LINES_PER_PAGE));
  wordCountEl.textContent = `Pg ${cursorPage}/${totalPages} - ${lines} ln - ${words} wd`;
}

function getLineHeightPx() {
  return parseFloat(getComputedStyle(editor).lineHeight) || 32;
}

function resizeEditor() {
  const lines = countLines(editor.value);
  const pages = Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
  editor.style.minHeight = `${pages * LINES_PER_PAGE * getLineHeightPx()}px`;
}

function scrollCaretIntoView() {
  if (!writingWell) return;
  const lineIndex = editor.value.slice(0, editor.selectionStart).split("\n").length - 1;
  const caretY = editor.offsetTop + lineIndex * getLineHeightPx();
  const padding = getLineHeightPx() * 2;
  const top = writingWell.scrollTop;
  const bottom = top + writingWell.clientHeight;

  if (caretY < top + padding) {
    writingWell.scrollTop = Math.max(0, caretY - padding);
  } else if (caretY + getLineHeightPx() > bottom - padding) {
    writingWell.scrollTop = caretY - writingWell.clientHeight + getLineHeightPx() + padding;
  }
}

function persistDraft() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      title: titleInput.value,
      body: editor.value,
      filename: activeFilename,
      createdAt: activeCreatedAt,
      updatedAt: new Date().toISOString(),
    })
  );
  saveStatusEl.textContent = `Draft saved - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function scheduleDraftSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistDraft, 500);
}

function hasNoteContent() {
  return Boolean(titleInput.value.trim() || editor.value.trim());
}

function isInteractiveTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("textarea, input, select, button, [contenteditable='true']"));
}

function insertTextInEditor(text) {
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? start;
  editor.setRangeText(text, start, end, "end");
  editor.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    })
  );
}

function routeLooseTypingToEditor(event) {
  if (
    event.defaultPrevented ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    event.key.length !== 1 ||
    isInteractiveTypingTarget(event.target)
  ) {
    return;
  }

  event.preventDefault();
  editor.focus();
  handleTypingFeedback(event, editor);
  insertTextInEditor(event.key);
}

// Keep the note's identity in step with what is on the sheet. When the sheet
// goes empty, end the current note so the next words you type begin a fresh
// file instead of overwriting the piece you just finished. When content first
// appears, stamp a stable creation time that ties every later save (and the
// vault filename) to this one note.
function syncNoteIdentityWithContent() {
  if (hasNoteContent()) {
    if (!activeCreatedAt) {
      activeCreatedAt = new Date().toISOString();
    }
    return;
  }
  activeFilename = null;
  activeCreatedAt = null;
  lastVaultFingerprint = "";
  clearTimeout(vaultSaveTimer);
}

function scheduleVaultAutoSave() {
  if (!isElectron || !hasNoteContent()) return;
  clearTimeout(vaultSaveTimer);
  vaultSaveTimer = setTimeout(autoSaveToVault, AUTOSAVE_DELAY);
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    titleInput.value = draft.title || "";
    editor.value = draft.body || "";
    activeFilename = draft.filename || null;
    activeCreatedAt = draft.createdAt || null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function slugify(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "untitled-note"
  );
}

function ensureNoteIdentity(title) {
  if (!activeCreatedAt) {
    activeCreatedAt = new Date().toISOString();
  }
  if (!activeFilename) {
    activeFilename = `${slugify(title || `note-${new Date().toISOString().slice(0, 10)}`)}.md`;
  }
  return activeFilename;
}

function getVaultFingerprint(filename, title, body) {
  return JSON.stringify({ filename, title: title.trim(), body });
}

function buildMarkdown(title, body, createdAt = new Date().toISOString()) {
  const now = new Date();
  const displayTitle = title.trim() || "Untitled";
  const safeTitle = displayTitle.replace(/"/g, '\\"');
  return `---
created: ${createdAt}
updated: ${now.toISOString()}
source: typewriter-desk
title: "${safeTitle}"
---

# ${displayTitle}

${body.trimEnd()}
`;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function warmAudio() {
  if (audioWarm || !soundEnabled) return;
  audioWarm = true;
  const warm = new Audio(SOUND_FILES.key[0]);
  warm.volume = 0.001;
  warm.play().then(() => warm.pause()).catch(() => {});
}

function playSample(url, volume = 0.55, rate = 1) {
  if (!soundEnabled) return;
  warmAudio();
  const clip = new Audio(url);
  clip.volume = volume;
  clip.playbackRate = rate;
  clip.play().catch(() => {});
}

function playTypeClick(kind = "char") {
  if (kind === "space") {
    playSample(SOUND_FILES.space[0], 0.5, 0.98 + Math.random() * 0.04);
    return;
  }
  if (kind === "backspace") {
    playSample(SOUND_FILES.backspace[0], 0.48, 0.96 + Math.random() * 0.06);
    return;
  }
  playSample(pickRandom(SOUND_FILES.key), 0.45 + Math.random() * 0.08, 0.92 + Math.random() * 0.12);
}

function playBell() {
  playSample(SOUND_FILES.bell[0], 0.5, 1);
}

function playCarriageSlide() {
  playSample(SOUND_FILES.carriage[0], 0.45, 1);
}

function getColumnInLine(text, index) {
  const before = text.slice(0, index);
  return before.slice(before.lastIndexOf("\n") + 1).length;
}

function syncCarriagePosition() {
  const col = Math.min(getColumnInLine(editor.value, editor.selectionStart), CHARS_PER_LINE);
  typebar.style.setProperty("--strike-x", `${Math.min(col * CHAR_WIDTH, MAX_STRIKE_X)}px`);

  if (carriageBlock?.parentElement) {
    const travel = Math.max(60, carriageBlock.parentElement.clientWidth - 90);
    carriageBlock.style.setProperty("--carriage-x", `${20 + (col / CHARS_PER_LINE) * travel}px`);
  }
}

function flashStrike() {
  typebar.classList.remove("striking");
  requestAnimationFrame(() => {
    typebar.classList.add("striking");
    setTimeout(() => typebar.classList.remove("striking"), 130);
  });
}

function handleTypingFeedback(event, field) {
  if (event.key === "Enter") {
    if (soundEnabled) {
      playTypeClick("char");
      playCarriageSlide();
      setTimeout(playBell, 350);
    }
    if (field === editor) {
      requestAnimationFrame(() => {
        typebar.style.setProperty("--strike-x", "0px");
        if (carriageBlock) carriageBlock.style.setProperty("--carriage-x", "3rem");
        syncCarriagePosition();
      });
    }
    return;
  }

  if (event.key.length === 1 || event.key === "Backspace") {
    const kind = event.key === "Backspace" ? "backspace" : event.key === " " ? "space" : "char";
    if (soundEnabled) playTypeClick(kind);
    flashStrike();
  }
}

function updateSoundButton() {
  btnSound.textContent = `Sound: ${soundEnabled ? "On" : "Off"}`;
  soundLamp?.classList.toggle("lamp-on", soundEnabled);
}

async function openVaultDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("typewriter-desk", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeVaultHandle(handle) {
  const db = await openVaultDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, VAULT_HANDLE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadVaultHandle() {
  const db = await openVaultDb();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readonly");
    const req = tx.objectStore("handles").get(VAULT_HANDLE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

async function hasVaultPermission(handle) {
  if (!handle) return false;
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

function setVaultConnected(connected) {
  vaultLamp.textContent = connected ? "VAULT" : "VAULT";
  vaultLamp.classList.toggle("lamp-on", connected);
  btnVault.textContent = connected ? "Vault Linked" : "Link Vault";
}

async function refreshVaultStatus() {
  if (isElectron) {
    try {
      const info = await window.typi.getVaultInfo();
      setVaultConnected(info.connected);
    } catch {
      setVaultConnected(false);
    }
    return;
  }
  if (!("showDirectoryPicker" in window)) {
    setVaultConnected(false);
    return;
  }
  try {
    const handle = await loadVaultHandle();
    setVaultConnected(await hasVaultPermission(handle));
  } catch {
    setVaultConnected(false);
  }
}

async function linkVault() {
  if (isElectron) {
    try {
      const info = await window.typi.pickVault();
      setVaultConnected(info.connected);
      if (info.connected) {
        showToast(`Linked to vault: ${info.name}`);
      }
      return info.connected ? info : null;
    } catch {
      showToast("Could not link vault folder.");
      return null;
    }
  }
  if (!("showDirectoryPicker" in window)) {
    showToast("Use Chrome or Edge for direct Obsidian saves.");
    return null;
  }
  try {
    const handle = await window.showDirectoryPicker({
      id: "obsidian-vault",
      mode: "readwrite",
      startIn: "documents",
    });
    await storeVaultHandle(handle);
    setVaultConnected(true);
    showToast(`Linked to vault: ${handle.name}`);
    return handle;
  } catch (err) {
    if (err.name !== "AbortError") showToast("Could not link vault folder.");
    return null;
  }
}

async function getWritableVault() {
  let handle = await loadVaultHandle();
  if (handle && (await hasVaultPermission(handle))) return handle;
  handle = await linkVault();
  if (handle && (await hasVaultPermission(handle))) return handle;
  if (handle && (await handle.requestPermission({ mode: "readwrite" })) === "granted") return handle;
  return null;
}

async function saveToVault(markdown, filename) {
  if (isElectron) {
    const result = await window.typi.saveNote(filename, markdown);
    if (result.ok) {
      // The vault may store the note under a de-duplicated name so it never
      // overwrites a different note. Adopt the real on-disk name so later
      // edits keep updating the same file.
      if (result.filename) activeFilename = result.filename;
      return "vault";
    }
    downloadMarkdown(markdown, filename);
    showToast(result.error || "Save failed - downloaded instead.");
    return "download";
  }

  const vault = await getWritableVault();
  if (!vault) {
    downloadMarkdown(markdown, filename);
    showToast("Link your vault first - downloaded the note instead.");
    return "download";
  }
  const notesDir = await vault.getDirectoryHandle(NOTES_FOLDER, { create: true });
  const fileHandle = await notesDir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(markdown);
  await writable.close();
  return "vault";
}

function downloadMarkdown(markdown, filename) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  anchor.download = filename;
  anchor.click();
}

async function saveNote() {
  const title = titleInput.value.trim();
  const body = editor.value;
  const filename = ensureNoteIdentity(title);

  btnSave.disabled = true;
  btnSave.textContent = "Saving...";
  try {
    const markdown = buildMarkdown(title, body, activeCreatedAt);
    const method = await saveToVault(markdown, filename);
    if (method === "vault") {
      const savedName = activeFilename || filename;
      lastVaultFingerprint = getVaultFingerprint(savedName, title, body);
      persistDraft();
      showToast(`Saved to Obsidian: ${savedName}`);
      saveStatusEl.textContent = `In vault - ${savedName}`;
      if (soundEnabled) playBell();
    }
  } catch (err) {
    console.error(err);
    downloadMarkdown(buildMarkdown(title, body, activeCreatedAt), filename);
    showToast("Save failed - downloaded instead.");
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "Save to Obsidian";
  }
}

function clearSheet() {
  if ((titleInput.value.trim() || editor.value.trim()) && !window.confirm("Start a fresh sheet?")) return;
  titleInput.value = "";
  editor.value = "";
  activeFilename = null;
  activeCreatedAt = null;
  lastVaultFingerprint = "";
  clearTimeout(vaultSaveTimer);
  updateWordCount();
  syncCarriagePosition();
  resizeEditor();
  persistDraft();
  editor.focus();
}

editor.addEventListener("input", () => {
  syncNoteIdentityWithContent();
  updateWordCount();
  scheduleDraftSave();
  scheduleVaultAutoSave();
  syncCarriagePosition();
  resizeEditor();
  scrollCaretIntoView();
});

editor.addEventListener("click", () => {
  syncCarriagePosition();
  updateWordCount();
});

editor.addEventListener("keyup", () => {
  syncCarriagePosition();
  updateWordCount();
});

titleInput.addEventListener("input", () => {
  syncNoteIdentityWithContent();
  scheduleDraftSave();
  scheduleVaultAutoSave();
});

function blockImportedText(event) {
  event.preventDefault();
  showToast("Paste is disabled - Typi is for writing it yourself.");
}

function blockImportedInput(event) {
  const isImport = event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop";
  if (isImport && event.dataTransfer) {
    blockImportedText(event);
  }
}

async function autoSaveToVault() {
  if (!isElectron || !hasNoteContent()) return;

  const title = titleInput.value.trim();
  const body = editor.value;
  const filename = ensureNoteIdentity(title);
  const fingerprint = getVaultFingerprint(filename, title, body);
  if (fingerprint === lastVaultFingerprint) return;

  const markdown = buildMarkdown(title, body, activeCreatedAt);

  try {
    const result = await window.typi.saveNote(filename, markdown);
    if (!result.ok) {
      saveStatusEl.textContent = "Local draft saved - vault autosave failed";
      return;
    }
    // Adopt the real on-disk name and re-key the fingerprint to it so the next
    // autosave doesn't needlessly re-write because the name changed.
    if (result.filename) activeFilename = result.filename;
    const savedName = activeFilename || filename;
    lastVaultFingerprint = getVaultFingerprint(savedName, title, body);
    persistDraft();
    setVaultConnected(true);
    saveStatusEl.textContent = `Auto-saved to vault - ${savedName}`;
  } catch {
    saveStatusEl.textContent = "Local draft saved - vault autosave failed";
  }
}

editor.addEventListener("paste", blockImportedText);
editor.addEventListener("drop", blockImportedText);
editor.addEventListener("beforeinput", blockImportedInput);
titleInput.addEventListener("paste", blockImportedText);
titleInput.addEventListener("drop", blockImportedText);
titleInput.addEventListener("beforeinput", blockImportedInput);

document.addEventListener("keydown", routeLooseTypingToEditor, true);

editor.addEventListener("keydown", (event) => {
  handleTypingFeedback(event, editor);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNote();
  }
});

titleInput.addEventListener("keydown", (event) => {
  handleTypingFeedback(event, titleInput);
  if (event.key === "Enter") {
    event.preventDefault();
    editor.focus();
  }
});

btnVault.addEventListener("click", async () => {
  const linked = await linkVault();
  if (linked) scheduleVaultAutoSave();
});
btnOpenObsidian?.addEventListener("click", async () => {
  if (!isElectron) {
    showToast("Open the installed Typi app to launch Obsidian.");
    return;
  }
  await autoSaveToVault();
  const result = await window.typi.openObsidian(activeFilename);
  if (result.ok) {
    showToast("Opened Typi Vault in Obsidian.");
  } else {
    showToast(result.error || "Could not open Obsidian.");
  }
});

btnShowNotes?.addEventListener("click", async () => {
  if (!isElectron) {
    showToast("Use your browser's saved vault folder.");
    return;
  }
  await autoSaveToVault();
  const result = await window.typi.showNotes();
  if (result.ok) {
    showToast("Opened Typi Notes folder.");
  } else {
    showToast(result.error || "Typi Notes folder could not be opened.");
  }
});
btnNew.addEventListener("click", clearSheet);
btnSave.addEventListener("click", saveNote);

btnSound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(SOUND_KEY, String(soundEnabled));
  updateSoundButton();
  if (soundEnabled) {
    warmAudio();
    playTypeClick("char");
  }
});

window.addEventListener("resize", resizeEditor);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
}

restoreDraft();
syncNoteIdentityWithContent();
updateWordCount();
resizeEditor();
updateSoundButton();
syncCarriagePosition();
refreshVaultStatus().then(() => {
  if (isElectron) {
    window.typi.getVaultInfo().then((info) => {
      if (info.connected) {
        showToast(`Vault ready: ${info.name} -> ${info.notesFolder}/`);
        scheduleVaultAutoSave();
      }
    });
  }
});
editor.focus();
