// Checks GitHub releases for new versions. Windows and Linux download in the background and install on
// restart; macOS can't self-update unsigned apps, so it only offers the download page.
const { app, shell } = require("electron");

const RELEASES_URL = "https://github.com/almeidabbm/tickety/releases/latest";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const canSelfUpdate = process.platform !== "darwin";

// GitHub gives release notes as HTML (or a list of them); the admin window shows plain text only.
function notesToText(notes) {
  const html = Array.isArray(notes) ? notes.map((n) => n.note || "").join("\n") : notes || "";
  return html
    .replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}

function startUpdater(onChange) {
  let status = { state: "idle", version: app.getVersion() };
  const set = (next) => {
    status = { ...status, ...next };
    onChange(status);
  };

  if (!app.isPackaged) {
    status = { ...status, state: "dev" };
    return { getStatus: () => status, check: () => {}, install: () => {}, openDownload: () => {} };
  }

  // Loaded here, not at the top: creating it starts the platform updater, which dev runs and tests don't want.
  const { autoUpdater } = require("electron-updater");
  autoUpdater.autoDownload = canSelfUpdate;
  // Only install when staff press the button: installing on quit can run during a Windows shutdown and get cut off.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("checking-for-update", () => {
    if (!["downloading", "ready"].includes(status.state)) set({ state: "checking" });
  });
  autoUpdater.on("update-not-available", () => set({ state: "idle" }));
  autoUpdater.on("update-available", (info) =>
    set({
      state: canSelfUpdate ? "downloading" : "available",
      newVersion: info.version,
      notes: notesToText(info.releaseNotes),
      percent: 0,
    })
  );
  autoUpdater.on("download-progress", (p) => set({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) =>
    set({ state: "ready", newVersion: info.version, notes: notesToText(info.releaseNotes) || status.notes })
  );
  // Offline or GitHub down: say so quietly and retry on the next check. Keep a finished download.
  autoUpdater.on("error", (error) => {
    console.error("update check failed:", error.message);
    if (status.state !== "ready") set({ state: "error" });
  });

  const check = () => {
    if (status.state === "downloading" || status.state === "ready") return;
    autoUpdater.checkForUpdates().catch(() => {});
  };
  check();
  setInterval(check, CHECK_EVERY_MS);

  return {
    getStatus: () => status,
    check,
    install: () => {
      if (status.state === "ready") autoUpdater.quitAndInstall(true, true);
    },
    openDownload: () => shell.openExternal(RELEASES_URL),
  };
}

module.exports = { startUpdater, notesToText };
