const ticketCard = document.getElementById("ticketCard");
const ticketNumber = document.getElementById("ticketNumber");
const businessEl = document.getElementById("business");
const historyEl = document.getElementById("history");
const historyList = document.getElementById("historyList");
const images = document.querySelectorAll("img.backgroundOverlay");

let photos = [];
let currentPhoto;
let ticket;
let history = [];
// Created up front so calls from the admin window chime too; main allows audio without a key press.
const audio = new AudioContext();

function showPhoto(name) {
  const photo = photos.find((p) => p.name === name);
  currentPhoto = photo && photo.name;
  const [active, idle] = images[0].hidden ? [images[1], images[0]] : [images[0], images[1]];
  if (!photo) {
    images.forEach((img) => (img.hidden = true));
    return;
  }
  if (!active.hidden && active.src === photo.url) return;
  idle.src = photo.url;
  idle.hidden = false;
  active.hidden = true;
}

function stepPhoto(offset) {
  if (photos.length === 0) return;
  const index = photos.findIndex((p) => p.name === currentPhoto);
  showPhoto(photos[(index + offset + photos.length) % photos.length].name);
}

// motion: "intro" | "call" | "back"; it names the class that runs the matching animation.
function renderTicket(motion) {
  ticketNumber.textContent = ticket;
  historyList.replaceChildren(...history.map((n) => Object.assign(document.createElement("li"), { textContent: n })));
  historyEl.hidden = history.length === 0;
  ticketCard.className = "";
  void ticketCard.offsetWidth; // restart the animation
  ticketCard.className = motion;
}

function renderBusiness(name) {
  businessEl.textContent = name;
  businessEl.hidden = !name;
  businessEl.classList.toggle("long", isLongBusinessName(name));
}

function chime() {
  playChime(audio);
}

const MAX_SOUND_SECONDS = 6;
let playing;

// An uploaded sound plays for at most 6 s, then fades out, so a long file can't drown the next call.
// Anything wrong with the file falls back to the built-in chime.
function playCall(state) {
  const choice = state.chime && state.sounds.find((sound) => sound.name === state.chime);
  if (!choice) return chime();
  if (playing) playing.pause();
  const player = new Audio(choice.url);
  playing = player;
  player.play().catch((err) => {
    console.error("could not play the chosen sound", err);
    chime();
  });
  setTimeout(() => {
    const fade = setInterval(() => {
      player.volume = Math.max(0, player.volume - 0.1);
      if (player.volume === 0) {
        clearInterval(fade);
        player.pause();
      }
    }, 50);
  }, (MAX_SOUND_SECONDS - 0.5) * 1000);
}

function onState({ state, reason }) {
  if (reason === "business") return renderBusiness(state.business);
  if (reason === "photos") {
    photos = state.photos;
    showPhoto(photos.some((p) => p.name === currentPhoto) ? currentPhoto : photos[0] && photos[0].name);
    return;
  }
  if (!["next", "back", "set"].includes(reason) || state.ticket === ticket) return;

  if (reason === "back") {
    history.shift();
    stepPhoto(-1);
  } else {
    if (ticket !== undefined) history = [ticket, ...history.filter((n) => n !== state.ticket)].slice(0, 3);
    stepPhoto(1);
    if (state.sound) playCall(state);
  }
  ticket = state.ticket;
  renderTicket(reason === "back" ? "back" : "call");
}

function call(method) {
  window.tickety[method]().catch((err) => console.error(`tickety.${method} failed`, err));
}

const keyActions = { Enter: "next", " ": "next", ArrowRight: "next", Backspace: "back", ArrowLeft: "back" };

document.addEventListener("keydown", (event) => {
  if (audio.state === "suspended") audio.resume();
  if (event.repeat || !window.tickety) return;

  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    window.tickety.openAdmin();
    return;
  }
  const action = keyActions[event.key];
  if (action) {
    event.preventDefault();
    call(action);
  }
});

// A left click anywhere on the display calls the next ticket, like Enter or Space.
document.addEventListener("click", (event) => {
  if (audio.state === "suspended") audio.resume();
  if (event.button !== 0 || !window.tickety) return;
  call("next");
});

if (!window.tickety) {
  console.error("window.tickety is missing; the preload script did not load");
} else {
  window.tickety.onState(onState);
  window.tickety
    .getState()
    .then((state) => {
      ticket = state.ticket;
      photos = state.photos;
      showPhoto(photos[0] && photos[0].name);
      renderBusiness(state.business);
      renderTicket("intro");
    })
    .catch((err) => console.error("tickety.getState failed", err));
}
