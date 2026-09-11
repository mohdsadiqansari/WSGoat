const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

let mainWindow = null;
const SERVER_URL = "http://localhost:3000";

function checkServer(callback) {
  const req = http.get(SERVER_URL, res => {
    callback(true);
  });
  req.on("error", () => {
    callback(false);
  });
  req.setTimeout(1000, () => {
    req.destroy();
    callback(false);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 800,
    minHeight: 600,
    title: "WhatsApp Web - Desktop Edition",
    backgroundColor: "#111b21",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  checkServer(isRunning => {
    if (isRunning) {
      mainWindow.loadURL(SERVER_URL);
    } else {
      mainWindow.loadFile(path.join(__dirname, "public", "index.html"));
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
