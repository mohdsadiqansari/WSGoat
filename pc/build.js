const packager = require("electron-packager");
const path = require("path");

async function build() {
  console.log("Starting build...");
  try {
    const appPaths = await packager({
      dir: __dirname,
      name: "WhatsAppWeb",
      platform: "win32",
      arch: "x64",
      out: path.join(__dirname, "dist"),
      overwrite: true
    });
    console.log("Build finished successfully!");
    console.log("Application path:", appPaths);
  } catch (err) {
    console.error("Build failed:", err);
  }
}

build();
