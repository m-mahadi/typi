const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("typi", {
  getVaultInfo: () => ipcRenderer.invoke("vault:info"),
  pickVault: () => ipcRenderer.invoke("vault:pick"),
  saveNote: (filename, markdown) => ipcRenderer.invoke("vault:save", { filename, markdown }),
});
