const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const projectDir = context.packager.projectDir;
  const rcedit = path.join(
    projectDir,
    "node_modules",
    "electron-winstaller",
    "vendor",
    "rcedit.exe",
  );
  const exePath = path.join(context.appOutDir, "Typi.exe");
  const iconPath = path.join(projectDir, "build", "icon.ico");

  execFileSync(rcedit, [exePath, "--set-icon", iconPath], {
    stdio: "inherit",
  });
};
