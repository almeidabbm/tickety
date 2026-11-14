// Persistent state and photo storage. No Electron here: directories and trash are passed in, so tests can use a temp dir.
const fs = require("node:fs");
const path = require("node:path");
const { advanceTicket, previousTicket, parseTicket, isImageFile } = require("../shared/queue");

const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) || {};
  } catch {
    return {};
  }
}

// Keeps only the last path segment and harmless characters, so a name can never leave the photos dir.
function safeName(name) {
  return String(name)
    .split(/[\\/]/)
    .pop()
    .replace(/[^\p{L}\p{N}._ ()-]/gu, "_")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(-120)
    // Windows can't create files named after devices (CON.jpg, NUL.png…).
    .replace(/^(con|prn|aux|nul|com\d|lpt\d)(?=\.)/i, "_$1");
}

// Taken = on disk or still in the list (e.g. mid-removal); compared without case, as Windows and macOS do.
function uniqueName(dir, name, listed) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  const taken = (candidate) =>
    fs.existsSync(path.join(dir, candidate)) || listed.some((n) => n.toLowerCase() === candidate.toLowerCase());
  let candidate = name;
  for (let i = 2; taken(candidate); i++) candidate = `${base} (${i})${ext}`;
  return candidate;
}

// Antivirus or the indexer can briefly lock state.json on Windows, which makes rename fail.
function renameWithRetry(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return fs.renameSync(from, to);
    } catch (error) {
      if (attempt >= 5 || !["EPERM", "EBUSY", "EACCES"].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * attempt);
    }
  }
}

function openStore({ dir, seedDir, trash }) {
  const stateFile = path.join(dir, "state.json");
  const photosDir = path.join(dir, "backgrounds");

  if (!fs.existsSync(photosDir)) {
    fs.mkdirSync(photosDir, { recursive: true });
    if (seedDir && fs.existsSync(seedDir)) {
      for (const name of fs.readdirSync(seedDir).filter(isImageFile)) {
        fs.copyFileSync(path.join(seedDir, name), path.join(photosDir, name));
      }
    }
  }

  const raw = readJson(stateFile);
  const onDisk = fs.readdirSync(photosDir).filter(isImageFile);
  const listed = Array.isArray(raw.photos)
    ? raw.photos.filter((name, i, all) => onDisk.includes(name) && all.indexOf(name) === i)
    : [];
  let state = {
    ticket: parseTicket(raw.ticket) ?? 1,
    sound: typeof raw.sound === "boolean" ? raw.sound : true,
    photos: [...listed, ...onDisk.filter((name) => !listed.includes(name))],
  };

  // Write first, then update memory, so a failed save never leaves the two out of step.
  // fsync before rename so a power cut can't leave an empty state.json.
  const commit = (changes) => {
    const next = { ...state, ...changes };
    const tmp = `${stateFile}.tmp`;
    try {
      const fd = fs.openSync(tmp, "w");
      try {
        fs.writeSync(fd, JSON.stringify(next, null, 2));
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      renameWithRetry(tmp, stateFile);
    } catch (error) {
      console.error("could not save state:", error);
      throw new Error("Não foi possível guardar. Tente outra vez.");
    }
    state = next;
    return state;
  };

  return {
    photosDir,
    getState: () => state,
    next: () => commit({ ticket: advanceTicket(state.ticket) }),
    back: () => commit({ ticket: previousTicket(state.ticket) }),
    setTicket: (value) => {
      const ticket = parseTicket(value);
      if (ticket === null) throw new Error("A senha tem de ser um número inteiro entre 1 e 99.");
      return commit({ ticket });
    },
    setSound: (sound) => commit({ sound: Boolean(sound) }),
    // files: [{ name, data: Buffer }]. Saves the valid ones; refused lists the others with the reason.
    addPhotos: (files) => {
      const added = [];
      const refused = [];
      for (const { name, data } of files) {
        const safe = safeName(name);
        if (!isImageFile(safe)) refused.push(`${name} (não é uma imagem)`);
        else if (data.length > MAX_PHOTO_BYTES) refused.push(`${name} (maior que 25 MB)`);
        else {
          const unique = uniqueName(photosDir, safe, [...state.photos, ...added]);
          try {
            fs.writeFileSync(path.join(photosDir, unique), data, { flag: "wx" });
            added.push(unique);
          } catch (error) {
            console.error("could not save photo:", error);
            refused.push(`${name} (não foi possível guardar)`);
          }
        }
      }
      return { state: added.length ? commit({ photos: [...state.photos, ...added] }) : state, refused };
    },
    reorderPhotos: (names) => {
      const isPermutation =
        Array.isArray(names) &&
        names.length === state.photos.length &&
        new Set(names).size === names.length &&
        names.every((name) => state.photos.includes(name));
      if (!isPermutation) throw new Error("A nova ordem não corresponde às fotografias atuais.");
      return commit({ photos: [...names] });
    },
    removePhoto: async (name) => {
      if (!state.photos.includes(name)) throw new Error("Fotografia não encontrada.");
      const file = path.join(photosDir, name);
      if (fs.existsSync(file)) await trash(file);
      return commit({ photos: state.photos.filter((photo) => photo !== name) });
    },
  };
}

module.exports = { MAX_PHOTO_BYTES, openStore };
