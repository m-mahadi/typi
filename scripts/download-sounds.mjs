import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "sounds");

const FILES = {
  "key-strike.wav": 1119,
  "key-strike-alt.wav": 1364,
  "key-strike-3.wav": 1382,
  "space-bar.wav": 1125,
  "backspace.wav": 1367,
  "carriage-return.wav": 1381,
  "bell.wav": 1368,
};

fs.mkdirSync(outDir, { recursive: true });

for (const [name, id] of Object.entries(FILES)) {
  const url = `https://assets.mixkit.co/active_storage/sfx/${id}/${id}.wav`;
  const target = path.join(outDir, name);
  execSync(`curl.exe -L -o "${target}" "${url}"`, { stdio: "inherit" });
}

console.log("Downloaded Mixkit typewriter sounds (Mixkit License).");
