// Runs every *.test.js under Electron's own Node (16 for Electron 22), the runtime the app ships with on Windows 7.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const electron = require("electron");

const root = path.join(__dirname, "..");
const files = ["main", "shared"].flatMap((dir) =>
  fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".test.js")).map((f) => path.join(dir, f))
);
for (const file of files) {
  execFileSync(electron, [file], { cwd: root, stdio: "inherit", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
}
