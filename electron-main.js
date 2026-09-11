const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;

function checkServerReady(callback, retries = 30) {
  const req = http.get(`http://localhost:${PORT}/api/me`, res => {
    callback(true);
  });
  req.on("error", () => {
    if (retries > 0) {
      setTimeout(() => checkServerReady(callback, retries - 1), 300);
    } else {
      callback(false);
    }
  });
}

function startServer() {
  try {
    // If not running, start server in-process
    require("./src/server.js");
  } catch (err) {
    console.log("Server may already be running or initialized:", err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,
    title: "WhatsApp Web",
    backgroundColor: "#111b21",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  checkServerReady(ready => {
    if (ready) {
      mainWindow.loadURL(`http://localhost:${PORT}/`);
    } else {
      // Fallback load static html directly
      mainWindow.loadFile(path.join(__dirname, "public", "index.html"));
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServer();
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
