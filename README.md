# Tickety

A desktop "now serving" screen for queues. It shows the current ticket number over a rotating photo background.

## Use

```sh
npm install
npm start
```

The app opens fullscreen. Press **Enter** (or Space / → / a mouse click) to call the next ticket, and **Backspace** (or ←) to go back. Numbers go from 1 to 99 and then start again at 1. Each call plays a soft chime and fades to the next photo. **F11** leaves or enters fullscreen.

The ticket number is saved, so it survives a restart.

## Admin

Press **Ctrl+,** (**Cmd+,** on a Mac) to open the admin window. From there you can set the number, set the business name shown at the top of the screen, turn the sound on or off, upload your own call sounds and choose one, and manage photos: drop in photos or whole folders, drag to reorder, and remove (with undo).

## Download

Installers for Windows (7 or later, 32- and 64-bit) and Linux are on the [releases page](https://github.com/almeidabbm/tickety/releases). Installed apps check for new versions every few hours. On Windows and Linux the update downloads in the background, and the admin window shows **Reiniciar e atualizar** when it's ready. It only installs when someone presses that button. They are not code-signed: on Windows choose "More info" → "Run anyway".

## Development

- `npm test` runs the unit tests.
- `npm run dist` builds installers into `dist/`.

## Releasing

1. Add a `## <new version>` section to `CHANGELOG.md`, in short, plain Portuguese for counter staff. It becomes the release notes and shows in the admin window when the update arrives.
2. Bump the version and push the tag:

```sh
npm version patch   # or minor / major: bumps package.json and creates a v* tag
git push --follow-tags
```

CI checks the tag matches `package.json`, builds every platform into a draft release, then publishes it with the changelog notes. Installed apps update from it.
- See `AGENTS.md` for the code layout and conventions.

## License

MIT
