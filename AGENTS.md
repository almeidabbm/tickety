# Tickety

Electron desktop app for a queue "now serving" screen: shows the current ticket number over a rotating photo background. UI text is Portuguese ("Senha atual" = "current ticket").

## Commands

- `npm install` — install dependencies.
- `npm run dist` — build installers into `dist/` for the current OS (electron-builder). CI (`.github/workflows/build.yml`) builds Windows and Linux (macOS is not released; `npm run dist` still builds it locally) on every push to `main` and publishes a GitHub release for `v*` tags.
- `npm start` — run the app. `electron-reload` restarts it on file changes.
- `npm test` — runs `node --test` over `*.test.js` (Node's built-in runner, no dependencies). No linter, formatter, or build/packaging step exist.
- Debugging: VS Code compound launch "Main + renderer" in `.vscode/launch.json` (renderer attaches on port 9222).

## Layout

- `main.js` — main process: fullscreen display window, admin window (Ctrl/Cmd+,), single-instance lock, and the IPC handlers behind `window.tickety`. Validates every renderer argument.
- `main/updater.js` — electron-updater against GitHub releases: checks every 6 h; Windows/Linux download in the background and install only when staff press "Reiniciar e atualizar" (never on quit); macOS only links to the download page (unsigned apps can't self-update). Release = add a `## <version>` section to `CHANGELOG.md` (plain Portuguese, shown to staff), then `npm version <patch|minor|major>` + `git push --follow-tags`. CI fails the release if that section is missing.
- `main/store.js` — persistent state (`state.json`), photo files (`backgrounds/`) and uploaded call sounds (`sounds/`, `chime` = chosen file or null for the built-in) in Electron's userData folder; no Electron imports, tested with `node --test`.
- `preloaders/preloader.js` — exposes `window.tickety` via `contextBridge`. Any new main-process capability needs an `ipcMain.handle` in `main.js` plus an entry here.
- `shared/chime.js` — the built-in Web Audio chime, used by the display and the admin preview.
- `shared/queue.js` — pure logic (ticket wrap, background rotation, image-file filter). Loaded as a plain `<script>` by the page and `require`d by `main.js` and tests, so keep it free of DOM and Electron APIs. Tests sit next to it in `shared/queue.test.js`.
- `renderers/renderer.js` — display page logic, plain browser script (no modules, no bundler). Enter/Space/→/left click next, Backspace/← back; cross-fades the photo and plays a Web Audio chime.
- `app/admin.html`, `app/css/admin.css`, `renderers/admin.js` — admin window: ticket controls, sound toggle, live preview, photo upload (files or folders, in batches), reorder and remove with undo.
- `app/index.html`, `app/css/main.css` — display markup and styles.
- `assets/images/` — default photos, copied into userData on first run only. Staff manage photos from the admin window afterwards.
- `assets/fonts/` — bundled Inter variable font (OFL, license alongside).

## How it works

- Two `img.backgroundOverlay` elements alternate: one visible, one `hidden`. Swapping the `hidden` attribute triggers the opacity transitions in `main.css`.
- Ticket number, sound setting and photo order persist in `userData/state.json`; photos live in `userData/backgrounds/`.

## Conventions

- Plain JavaScript, CommonJS in the main process, no framework, no runtime dependencies. Keep it that way unless a change clearly needs more.
- **Windows 7 support pins Electron 22.3.27 (Chrome 108, Node 16).** Do not upgrade Electron. No CSS nesting, and no CSS/JS features newer than Chrome 108 (e.g. no `color-mix()`, `toSorted()`); no Node APIs newer than 16 in the main process. Because Electron 22 gets no security fixes, never load remote content.
- Content-Security-Policy meta tags in both HTML pages; keep scripts and styles in files, not inline.
- Double quotes, semicolons, 2-space indentation.
- Conventional Commits (`feat:`, `fix:`).
- Put new logic in `shared/queue.js` with a test, and keep the renderer as thin DOM wiring.
- Run `npm test` after changes. Verify UI changes by running `npm start` and checking the window.
