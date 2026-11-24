const UNDO_MS = 6000;
const CHUNK_FILES = 5;
const CHUNK_BYTES = 40 * 1024 * 1024;
const api = window.tickety;
const $ = (id) => document.getElementById(id);
const EASE = "cubic-bezier(0.25, 1, 0.5, 1)";
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let state = { ticket: null, sound: true, photos: [], sounds: [], chime: null, business: "" };
let savingBusiness = null; // the name on its way to main, so Enter + blur don't save it twice
let previewName = null;
let dragged = null;
let uploading = false;
let calledTicket;
let called = []; // last numbers called, newest first, as the display shows them
let toastExit = null;
const pendingDeletes = new Map(); // name -> timeout id; most recent last

const placeholder = document.createElement("li");
placeholder.className = "placeholder";

// Electron IPC wraps rejections as "Error invoking remote method 'x': Error: msg".
function cleanMessage(error) {
  return String(error && error.message ? error.message : error)
    .replace(/^Error invoking remote method '[^']*': /, "")
    .replace(/^Error: /, "");
}

function visiblePhotos() {
  return state.photos.filter((photo) => !pendingDeletes.has(photo.name));
}

function update(next, reason) {
  const changed = state.ticket !== null && next.ticket !== state.ticket;
  const down = reason === "back" || (reason === "set" && next.ticket < state.ticket);
  const old = state.ticket;
  state = next;
  renderTicket(changed && { old, down });
  $("soundToggle").checked = state.sound;
  renderBusiness();
  renderSounds();
  if (!dragged) renderPhotos();
}

function run(promise, errorEl, reason) {
  return promise.then((next) => update(next, reason)).catch((error) => {
    errorEl.textContent = cleanMessage(error);
    api.getState().then(update); // undo any optimistic change
  });
}

// Mirrors the display's history: next/set push the previous number, back drops the newest.
function track({ state: next, reason }) {
  if (["next", "back", "set"].includes(reason) && next.ticket !== calledTicket) {
    if (reason === "back") called.shift();
    else if (calledTicket !== undefined) called = [calledTicket, ...called.filter((n) => n !== next.ticket)].slice(0, 3);
  }
  calledTicket = next.ticket;
}

function renderTicket(change) {
  const number = $("currentTicket");
  const current = document.createElement("span");
  current.textContent = state.ticket;
  $("previewNumber").textContent = state.ticket;
  $("previewHistoryList").replaceChildren(...called.map((n) => Object.assign(document.createElement("li"), { textContent: n })));
  $("previewHistory").hidden = called.length === 0;
  // Leave a running swap alone when the same number arrives again (IPC reply after the broadcast).
  const shown = number.querySelector("span:not(.ghost)");
  if (!change && shown && shown.textContent === current.textContent) return;
  number.replaceChildren(current);
  if (!change) return;
  if (reducedMotion()) {
    current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    return;
  }
  // The old number leaves as the new one arrives: up for next, down for back.
  const shift = change.down ? -0.3 : 0.3;
  const ghost = Object.assign(document.createElement("span"), { className: "ghost", textContent: change.old });
  ghost.setAttribute("aria-hidden", "true");
  number.append(ghost);
  ghost.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${-shift}em)`, opacity: 0 }], { duration: 165, easing: EASE, fill: "forwards" }).onfinish = () => ghost.remove();
  current.animate([{ transform: `translateY(${shift}em)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 220, easing: EASE });
}

function renderPreview() {
  const photos = visiblePhotos();
  const photo = photos.find((p) => p.name === previewName) || photos[0];
  const img = $("previewPhoto");
  img.hidden = !photo;
  if (photo && img.getAttribute("src") !== photo.url) img.src = photo.url;
}

function photoItem(photo, index, count) {
  const li = document.createElement("li");
  li.className = "photo";
  li.draggable = true;
  li.dataset.name = photo.name;

  const img = document.createElement("img");
  img.src = photo.url;
  img.alt = "";
  img.draggable = false;

  const position = document.createElement("span");
  position.className = "position";
  position.textContent = index + 1;

  const tools = document.createElement("div");
  tools.className = "tools";
  const label = `fotografia ${index + 1}`;
  tools.append(
    toolButton("left", "←", `Mover ${label} para a esquerda`, index === 0),
    toolButton("right", "→", `Mover ${label} para a direita`, index === count - 1),
    toolButton("remove", "Remover", `Remover ${label}`, false),
  );
  for (const button of tools.children) button.dataset.name = photo.name;

  li.append(img, position, tools);
  return li;
}

function toolButton(action, text, label, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  return button;
}

const tileRects = () =>
  new Map([...$("photoGrid").querySelectorAll(".photo")].filter((li) => li.offsetParent).map((li) => [li.dataset.name, li.getBoundingClientRect()]));

// FLIP: measure, change the DOM, then slide each tile from where it was. New tiles fade in, staggered.
function flip(mutate) {
  const before = tileRects();
  mutate();
  if (reducedMotion() || (before.size === 0 && !uploading)) return;
  let entering = 0;
  for (const li of $("photoGrid").querySelectorAll(".photo")) {
    const old = before.get(li.dataset.name);
    if (!old) {
      const delay = Math.min(entering++, 8) * 40; // capped so a big upload settles quickly
      li.animate([{ opacity: 0, transform: "scale(.98)" }, { opacity: 1, transform: "none" }], { duration: 250, delay, easing: EASE, fill: "backwards" });
      continue;
    }
    const now = li.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (Math.abs(dx) + Math.abs(dy) > 1) li.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 250, easing: EASE });
  }
}

function renderPhotos(focus) {
  const active = document.activeElement;
  focus = focus || (active && active.dataset.action ? { ...active.dataset } : null);
  const photos = visiblePhotos();
  const grid = $("photoGrid");
  flip(() => grid.replaceChildren(...photos.map((photo, i) => photoItem(photo, i, photos.length))));
  $("emptyState").hidden = photos.length > 0;
  renderPreview();
  if (focus) {
    const target = grid.querySelector(`button[data-name="${CSS.escape(focus.name)}"][data-action="${focus.action}"]`);
    if (target && !target.disabled) target.focus();
    else if (target) target.closest(".photo").querySelector("button:not(:disabled)").focus();
  }
}

// Reordering only sees visible photos; pending deletes keep their slots so the list stays a permutation.
function commitOrder(visibleNames) {
  const queue = [...visibleNames];
  const names = state.photos.map((p) => (pendingDeletes.has(p.name) ? p.name : queue.shift()));
  const byName = new Map(state.photos.map((p) => [p.name, p]));
  update({ ...state, photos: names.map((name) => byName.get(name)) }); // optimistic, main confirms via onState
  run(api.reorderPhotos(names), $("photoError"));
}

function move(name, delta) {
  const names = visiblePhotos().map((p) => p.name);
  const from = names.indexOf(name);
  const to = from + delta;
  if (to < 0 || to >= names.length) return;
  names.splice(from, 1);
  names.splice(to, 0, name);
  commitOrder(names);
}

function removeLater(name) {
  if (pendingDeletes.has(name)) return;
  const names = visiblePhotos().map((p) => p.name);
  const neighbour = names[names.indexOf(name) + 1] || names[names.indexOf(name) - 1];
  pendingDeletes.set(name, setTimeout(() => commitDelete(name), UNDO_MS));
  showToast(true);
  const collapse = () => {
    renderPhotos(neighbour ? { name: neighbour, action: "remove" } : null);
    if (!neighbour) $("pickButton").focus();
  };
  const li = $("photoGrid").querySelector(`.photo[data-name="${CSS.escape(name)}"]`);
  if (!li) return collapse();
  const out = reducedMotion() ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.96)" }];
  li.animate(out, { duration: 180, easing: EASE, fill: "forwards" }).onfinish = collapse;
}

function showToast(show) {
  const toast = $("toast");
  if (toastExit) toastExit.cancel();
  toastExit = null;
  if (show || reducedMotion()) {
    toast.hidden = !show;
    return;
  }
  if (toast.hidden) return;
  toastExit = toast.animate([{ opacity: 1 }, { opacity: 0, transform: "translate(-50%, 8px)" }], { duration: 180, easing: EASE });
  toastExit.onfinish = () => {
    toast.hidden = true;
    toastExit = null;
  };
}

function commitDelete(name) {
  clearTimeout(pendingDeletes.get(name));
  pendingDeletes.delete(name);
  if (pendingDeletes.size === 0) showToast(false);
  return run(api.removePhoto(name), $("photoError"));
}

function undoDelete() {
  const name = [...pendingDeletes.keys()].pop();
  if (!name) return;
  clearTimeout(pendingDeletes.get(name));
  pendingDeletes.delete(name);
  if (pendingDeletes.size === 0) showToast(false);
  renderPhotos({ name, action: "remove" });
}

// Bulk uploads go in small batches so each IPC message stays light.
function batches(files) {
  const out = [];
  let current = [];
  let bytes = 0;
  for (const file of files) {
    if (current.length === CHUNK_FILES || (current.length && bytes + file.size > CHUNK_BYTES)) {
      out.push(current);
      current = [];
      bytes = 0;
    }
    current.push(file);
    bytes += file.size;
  }
  if (current.length) out.push(current);
  return out;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function setProgress(fraction) {
  $("uploadBar").firstElementChild.style.transform = `scaleX(${fraction})`;
}

function setBusy(busy) {
  uploading = busy;
  $("uploadBar").hidden = !busy;
  setProgress(0);
  $("dropZone").classList.toggle("busy", busy);
  $("pickButton").disabled = busy;
  $("folderButton").disabled = busy;
}

async function upload(allFiles) {
  if (uploading || allFiles.length === 0) return;
  const images = allFiles.filter((file) => isImageFile(file.name));
  const ignored = allFiles.length - images.length;
  // Same 25 MB limit as main, checked here so huge files are never read into memory.
  const files = images.filter((file) => file.size <= 25 * 1024 * 1024);
  const tooBig = images.filter((file) => file.size > 25 * 1024 * 1024).map((file) => file.name);
  const status = $("photoStatus");
  const errors = tooBig.length ? [`Não foi possível adicionar: ${tooBig.map((n) => `${n} (maior que 25 MB)`).join(", ")}.`] : [];
  const before = state.photos.length;
  let done = 0;
  $("photoError").replaceChildren();
  setBusy(true);
  try {
    for (const batch of batches(files)) {
      done += batch.length;
      status.textContent = `A carregar ${done} de ${files.length}…`;
      try {
        const photos = await Promise.all(batch.map(async (file) => ({ name: file.name, data: await file.arrayBuffer() })));
        update(await api.addPhotos(photos));
      } catch (error) {
        errors.push(cleanMessage(error)); // accepted files in this batch were still saved
      }
      setProgress(done / files.length);
    }
    update(await api.getState());
  } finally {
    const added = state.photos.length - before;
    const parts = [added > 0 ? plural(added, "fotografia adicionada", "fotografias adicionadas") : "Nenhuma fotografia adicionada"];
    if (ignored) parts.push(`${plural(ignored, "ficheiro ignorado", "ficheiros ignorados")} — não ${ignored === 1 ? "é imagem" : "são imagens"}`);
    status.textContent = parts.join(" · ");
    $("photoError").replaceChildren(...errors.map((message) => Object.assign(document.createElement("p"), { textContent: message })));
    $("fileInput").value = "";
    $("folderInput").value = "";
    setBusy(false);
  }
}

// Walks a dropped file or folder (recursively) into a flat list of Files.
async function readEntry(entry) {
  if (entry.isFile) return new Promise((resolve) => entry.file((file) => resolve([file]), () => resolve([])));
  const reader = entry.createReader();
  const next = () => new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
  const files = [];
  for (let entries = await next(); entries.length > 0; entries = await next()) {
    for (const child of entries) files.push(...(await readEntry(child)));
  }
  return files;
}

// Ticket controls
$("nextButton").addEventListener("click", () => run(api.next(), $("ticketError"), "next"));
$("backButton").addEventListener("click", () => run(api.back(), $("ticketError"), "back"));
$("resetButton").addEventListener("click", () => run(api.setTicket(1), $("ticketError"), "set"));
$("setForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("ticketInput");
  const n = Number(input.value);
  if (input.value.trim() === "" || !Number.isInteger(n) || n < 1 || n > 99) {
    $("ticketError").textContent = "Escreva um número de 1 a 99.";
    input.setAttribute("aria-invalid", "true");
    input.focus();
    return;
  }
  $("ticketError").textContent = "";
  input.removeAttribute("aria-invalid");
  input.value = "";
  run(api.setTicket(n), $("ticketError"), "set");
});
$("ticketInput").addEventListener("input", () => {
  $("ticketError").textContent = "";
  $("ticketInput").removeAttribute("aria-invalid");
});

$("soundToggle").addEventListener("change", (event) => run(api.setSound(event.target.checked), $("ticketError")));

// Business name: the preview follows the field while staff type; it's saved on Enter, on leaving the field, or with "Guardar".
function renderBusiness() {
  const input = $("businessInput");
  if (document.activeElement !== input && savingBusiness === null) input.value = state.business;
  const draft = parseBusinessName(input.value);
  const shown = draft === null ? input.value.trim() : draft;
  $("previewBusiness").textContent = shown;
  $("previewBusiness").hidden = !shown;
  $("previewBusiness").classList.toggle("long", isLongBusinessName(shown));
  $("businessSave").disabled = draft === state.business;
}

function saveBusiness() {
  const input = $("businessInput");
  const name = parseBusinessName(input.value);
  if (name === null) {
    $("businessError").textContent = `O nome pode ter no máximo ${MAX_BUSINESS_NAME} caracteres.`;
    return;
  }
  if (name === state.business || name === savingBusiness) return;
  savingBusiness = name;
  run(api.setBusiness(name), $("businessError")).then(() => {
    savingBusiness = null;
    if (state.business !== name) return;
    input.value = name;
    $("businessSave").textContent = "Guardado";
    renderBusiness();
  });
}

$("businessForm").addEventListener("submit", (event) => {
  event.preventDefault();
  saveBusiness();
});
$("businessInput").addEventListener("change", saveBusiness);
$("businessInput").addEventListener("input", () => {
  $("businessError").textContent = "";
  $("businessSave").textContent = "Guardar";
  renderBusiness();
});

// Photo picking and file drops
$("pickButton").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", (event) => upload([...event.target.files]));
$("folderButton").addEventListener("click", () => $("folderInput").click());
$("folderInput").addEventListener("change", (event) => upload([...event.target.files]));

const isFileDrag = (event) => event.dataTransfer.types.includes("Files");
// Stop Electron from navigating to a file dropped anywhere outside the drop zone.
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => event.preventDefault());

const zone = $("dropZone");
zone.addEventListener("dragover", (event) => {
  if (isFileDrag(event)) zone.classList.add("over");
});
zone.addEventListener("dragleave", (event) => {
  if (!zone.contains(event.relatedTarget)) zone.classList.remove("over");
});
zone.addEventListener("drop", (event) => {
  zone.classList.remove("over");
  if (!isFileDrag(event)) return;
  // Entries must be taken synchronously, before the drop event ends.
  const entries = [...event.dataTransfer.items].map((item) => item.webkitGetAsEntry()).filter(Boolean);
  Promise.all(entries.map(readEntry)).then((lists) => upload(lists.flat()));
});

// Grid: buttons, preview on hover/focus, drag to reorder
const grid = $("photoGrid");
grid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { name, action } = button.dataset;
  if (action === "left") move(name, -1);
  if (action === "right") move(name, 1);
  if (action === "remove") removeLater(name);
});

const showInPreview = (event) => {
  const item = event.target.closest(".photo");
  previewName = item ? item.dataset.name : null;
  renderPreview();
};
grid.addEventListener("mouseover", showInPreview);
grid.addEventListener("focusin", showInPreview);
grid.addEventListener("mouseleave", showInPreview);

grid.addEventListener("dragstart", (event) => {
  dragged = event.target.closest(".photo");
  dragged.classList.add("lifted");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragged.dataset.name);
  // Collapse the item after the browser has captured its drag image.
  requestAnimationFrame(() => {
    if (!dragged) return;
    dragged.classList.add("dragging");
    grid.insertBefore(placeholder, dragged);
  });
});
grid.addEventListener("dragover", (event) => {
  if (!dragged) return;
  event.preventDefault();
  const target = event.target.closest(".photo");
  if (!target || target === dragged) return;
  const rect = target.getBoundingClientRect();
  const after = event.clientX > rect.left + rect.width / 2;
  const before = after ? target.nextSibling : target;
  if (before !== placeholder && placeholder.nextSibling !== before) flip(() => grid.insertBefore(placeholder, before));
});
grid.addEventListener("drop", (event) => {
  if (!dragged) return;
  event.preventDefault();
  if (placeholder.parentNode) grid.insertBefore(dragged, placeholder);
  const names = [...grid.querySelectorAll(".photo")].map((li) => li.dataset.name);
  commitOrder(names);
});
grid.addEventListener("dragend", () => {
  dragged = null;
  renderPhotos(); // drops the placeholder and applies any state that arrived mid-drag
});

// Toast
$("undoButton").addEventListener("click", undoDelete);
window.addEventListener("beforeunload", () => {
  for (const name of [...pendingDeletes.keys()]) commitDelete(name);
});

api.onState((payload) => {
  track(payload);
  update(payload.state, payload.reason);
});
api.getState().then((next) => {
  if (calledTicket === undefined) calledTicket = next.ticket;
  update(next);
});

// Updates: the app checks GitHub on its own; this shows progress and what's new, and lets staff restart when it suits them.
const updateTexts = {
  dev: (s) => `Versão ${s.version} (desenvolvimento — sem atualizações).`,
  idle: (s) => `Versão ${s.version}. Está tudo em dia.`,
  checking: () => "A procurar atualizações…",
  error: (s) => `Versão ${s.version}. Não foi possível procurar atualizações — sem internet? Tentamos de novo mais tarde.`,
  downloading: (s) => `A transferir a versão ${s.newVersion}… ${s.percent || 0}%`,
  ready: (s) => `A versão ${s.newVersion} está pronta. Instala-se ao reiniciar.`,
  available: (s) => `Há uma versão nova (${s.newVersion}) para transferir.`,
};

function renderUpdate(status) {
  const text = updateTexts[status.state] || updateTexts.idle;
  $("updateText").textContent = text(status);

  const hasNews = Boolean(status.notes) && ["downloading", "ready", "available"].includes(status.state);
  $("updateNotes").hidden = !hasNews;
  if (hasNews) {
    $("updateNotes").querySelector(".notesTitle").textContent = `Novidades na versão ${status.newVersion}`;
    $("updateNotes").querySelector(".notesBody").textContent = status.notes;
  }

  const button = $("updateButton");
  button.hidden = status.state !== "ready" && status.state !== "available";
  button.textContent = status.state === "ready" ? "Reiniciar e atualizar" : "Abrir página de transferência";
  button.onclick = status.state === "ready" ? api.installUpdate : api.openDownload;

  $("checkButton").hidden = ["dev", "downloading", "ready"].includes(status.state);
  $("checkButton").disabled = status.state === "checking";
}

$("checkButton").addEventListener("click", () => api.checkUpdate());

if (api.getUpdate) {
  api.getUpdate().then(renderUpdate).catch((err) => console.error("tickety.getUpdate failed", err));
  api.onUpdate(renderUpdate);
}

// Call sounds: the built-in chime plus any uploaded ones; one is chosen, each can be heard first.
let previewAudio;
let player;

function listen(sound) {
  if (player) player.pause();
  if (!sound) {
    previewAudio = previewAudio || new AudioContext();
    playChime(previewAudio);
    return;
  }
  player = new Audio(sound.url);
  player.play().catch(() => {
    $("soundError").textContent = `Não foi possível tocar ${sound.name}. O ficheiro pode estar danificado.`;
  });
  setTimeout(() => player && player.pause(), 6000);
}

function renderSounds() {
  const choices = [{ name: null, label: "Som suave (incluído)" }, ...state.sounds.map((s) => ({ ...s, label: s.name }))];
  $("soundList").replaceChildren(
    ...choices.map((choice) => {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const radio = Object.assign(document.createElement("input"), { type: "radio", name: "chime", checked: state.chime === choice.name });
      radio.addEventListener("change", () => run(api.setChime(choice.name), $("soundError"), "sound"));
      label.append(radio, Object.assign(document.createElement("span"), { textContent: choice.label }));
      const play = Object.assign(document.createElement("button"), { type: "button", className: "quiet", textContent: "Ouvir" });
      play.setAttribute("aria-label", `Ouvir ${choice.label}`);
      play.addEventListener("click", () => listen(choice.name && choice));
      li.append(label);
      if (choice.name) {
        const remove = Object.assign(document.createElement("button"), { type: "button", className: "quiet danger", textContent: "Remover" });
        remove.setAttribute("aria-label", `Remover ${choice.label}`);
        remove.addEventListener("click", () => run(api.removeSound(choice.name), $("soundError"), "sound"));
        li.append(remove);
      }
      li.append(play); // last, so "Ouvir" lines up on every row
      return li;
    })
  );
}

async function uploadSounds(files) {
  $("soundError").textContent = "";
  const errors = [];
  let added = 0;
  // One file per call: sounds are small, and one bad file can't hold back the rest.
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      errors.push(`${file.name} (maior que 5 MB)`);
      continue;
    }
    $("soundStatus").textContent = `A carregar ${file.name}…`;
    try {
      update(await api.addSounds([{ name: file.name, data: await file.arrayBuffer() }]));
      added++;
    } catch (error) {
      errors.push(cleanMessage(error).replace(/^Não foi possível adicionar: /, "").replace(/\.$/, ""));
    }
  }
  $("soundStatus").textContent = added ? `${plural(added, "som adicionado", "sons adicionados")} — escolha-o na lista.` : "";
  if (errors.length) $("soundError").textContent = `Não foi possível adicionar: ${errors.join(", ")}.`;
  $("soundInput").value = "";
}

$("soundPickButton").addEventListener("click", () => $("soundInput").click());
$("soundInput").addEventListener("change", (event) => uploadSounds([...event.target.files]));
