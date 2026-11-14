# Tickety

A desktop "now serving" screen for queues. It shows the current ticket number over a rotating photo background.

## Use

```sh
npm install
npm start
```

Press **Enter** to call the next ticket. Numbers go from 1 to 99 and then start again at 1. Each press also fades to the next photo.

The ticket number is not saved: it goes back to 1 when the app restarts.

## Backgrounds

Put photos (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.avif`, `.bmp`) in `assets/images/`. They rotate in file-name order. The first photo shown is `background.jpeg`.

## Development

- `npm test` runs the unit tests.
- See `AGENTS.md` for the code layout and conventions.

## License

MIT
