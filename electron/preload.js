const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("typi", {
  getVaultInfo: () => ipcRenderer.invoke("vault:info"),
  pickVault: () => ipcRenderer.invoke("vault:pick"),
  openObsidian: () => ipcRenderer.invoke("vault:open-obsidian"),
  showNotes: () => ipcRenderer.invoke("vault:show-notes"),
  saveNote: (filename, markdown) => ipcRenderer.invoke("vault:save", { filename, markdown }),
});
