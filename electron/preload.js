const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("typi", {
  getVaultInfo: () => ipcRenderer.invoke("vault:info"),
  pickVault: () => ipcRenderer.invoke("vault:pick"),
  openObsidian: (filename) => ipcRenderer.invoke("vault:open-obsidian", { filename }),
  showNotes: () => ipcRenderer.invoke("vault:show-notes"),
  saveNote: (filename, markdown) => ipcRenderer.invoke("vault:save", { filename, markdown }),
});
