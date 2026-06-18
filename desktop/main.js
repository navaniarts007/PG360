// PG360 desktop shell. Like the Android wrapper, this is a thin window onto the
// live, server-rendered web app — so website deploys reach the desktop app with
// no rebuild. The installer is only rebuilt for native/version changes.

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");

const APP_URL = "https://pg360.software";
const APP_HOST = "pg360.software";

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: "#faf6f0",
    autoHideMenuBar: true,
    title: "PG360",
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
      const host = new URL(url).host;
      return host === APP_HOST || host.endsWith(".supabase.co") || host.endsWith(".cloudinary.com");
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

// Minimal menu: keep standard edit shortcuts (copy/paste) + reload, drop the
// noisy default template.
function buildMenu() {
  const template = [
    {
      label: "PG360",
      submenu: [
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
