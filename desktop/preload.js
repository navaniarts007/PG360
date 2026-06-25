// Minimal privileged bridge: expose a native print so the in-app (logged-in)
// page can be printed / saved as PDF reliably, since renderer window.print()
// is unreliable inside Electron.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pg360native", {
  platform: "electron",
  print: () => ipcRenderer.invoke("pg360:print"),
});
