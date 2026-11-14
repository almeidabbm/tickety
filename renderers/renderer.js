const ticketCard = document.getElementById("ticketCard");
const ticketNumber = document.getElementById("ticketNumber");
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

function chime() {
  const now = audio.currentTime;
  [[659.25, 0, 0.35, 0.9], [523.25, 0.32, 1.4, 0.6]].forEach(([freq, start, length, gain]) => {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, now + start);
    env.gain.linearRampToValueAtTime(0.25 * gain, now + start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    osc.connect(env).connect(audio.destination);
    osc.start(now + start);
    osc.stop(now + start + length + 0.05);
  });
}

function onState({ state, reason }) {
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
    if (state.sound) chime();
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
      renderTicket("intro");
    })
    .catch((err) => console.error("tickety.getState failed", err));
}
