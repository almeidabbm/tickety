# Tickety

Electron desktop app for a queue "now serving" screen: shows the current ticket number over a rotating photo background. UI text is Portuguese ("Senha atual" = "current ticket").

## Commands

- `npm install` — install dependencies (Electron 25).
- `npm start` — run the app. `electron-reload` restarts it on file changes.
- No tests, linter, formatter, or build/packaging step exist. `npm test` is a placeholder that fails.
- Debugging: VS Code compound launch "Main + renderer" in `.vscode/launch.json` (renderer attaches on port 9222).

## Layout

- `main.js` — main process: creates the window, loads `app/index.html`, handles the `backgrounds` IPC call (lists `assets/images/`).
- `preloaders/preloader.js` — exposes `window.utils.fetchBackgrounds()` via `contextBridge`. Any new main-process capability needs an `ipcMain.handle` in `main.js` plus an entry here.
- `renderers/renderer.js` — page logic, plain browser script (no modules, no bundler). Enter advances the ticket (1–99, wraps) and cross-fades to the next background.
- `app/index.html`, `app/css/main.css` — markup and styles. CSS uses native nesting.
- `assets/images/` — background photos; every file here is put in the rotation, so keep only images in it.
- `assets/fonts/` — bundled Oswald font.

## How it works

- Two `img.backgroundOverlay` elements alternate: one visible, one `hidden`. Swapping the `hidden` attribute triggers the opacity transitions in `main.css`.
- Ticket state lives only in memory; it resets to 1 on restart.

## Conventions

- Plain JavaScript, CommonJS in the main process, no framework, no dependencies beyond Electron. Keep it that way unless a change clearly needs more.
- Double quotes, semicolons, 2-space indentation.
- Conventional Commits (`feat:`, `fix:`).
- Verify UI changes by running `npm start` and checking the window; there is no automated test surface.
