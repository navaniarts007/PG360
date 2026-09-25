// Shanthi's Ladies Hostel desktop shell — same pattern as ../desktop (PG360's
// own Electron wrapper): a thin window onto the live, server-rendered web
// app, so website deploys reach the desktop app with no rebuild. Only the
// URL/branding differ from the main product's version.

const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");
const path = require("node:path");

const APP_URL = "https://pg360.shanthisladieshostel.com";
const APP_HOST = "pg360.shanthisladieshostel.com";
// TODO: once a dedicated MySQL user with remote access exists for this
// client, confirm whether any additional allowed hosts are needed here
// (matches the allowNavigation list in the Android capacitor config).

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#faf6f0",
    autoHideMenuBar: true,
    title: "Shanthi's Ladies Hostel", // TODO: swap for the client's chosen app name
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(APP_URL).catch(() => {
    mainWindow.loadFile(path.join(__dirname, "offline.html"));
  });

  // Show a friendly offline page if the site can't be reached.
  mainWindow.webContents.on("did-fail-load", (_e, _code, _desc, validatedURL) => {
    if (validatedURL.startsWith(APP_URL)) {
      mainWindow.loadFile(path.join(__dirname, "offline.html"));
    }
  });

  // Keep app navigation inside the window; open everything else (wa.me support,
  // external links) in the system browser.
  const isInternal = (url) => {
    try {
      return new URL(url).host === APP_HOST;
    } catch {
      return false;
    }
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Print / Save-as-PDF the current in-app page (keeps the logged-in session).
function printWindow() {
  if (!mainWindow) return;
  mainWindow.webContents.print({ printBackground: true });
}
ipcMain.handle("pg360:print", printWindow);

// Minimal menu: keep standard edit shortcuts (copy/paste) + reload, drop the
// noisy default template.
function buildMenu() {
  const template = [
    {
      label: "App",
      submenu: [
        { label: "Print…", accelerator: "CmdOrCtrl+P", click: printWindow },
        { type: "separator" },
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
