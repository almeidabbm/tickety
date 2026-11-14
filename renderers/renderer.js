let ticket = 1;
let loadedBackgrounds = [];

utils.fetchBackgrounds().then((bgs) => {
  loadedBackgrounds = bgs;
});

const ticketNumber = document.getElementById("ticketNumber");
ticketNumber.innerText = ticket;

function getActiveBackgroundImg() {
  return document.querySelector("img.backgroundOverlay:not([hidden])");
}

function getHiddenBackgroundImg() {
  return document.querySelector("img.backgroundOverlay[hidden]");
}

function toggleImageEl(newBackground) {
  const hiddenImgEl = getHiddenBackgroundImg();
  const activeImgEl = getActiveBackgroundImg();

  if (hiddenImgEl && activeImgEl) {
    // Setting the hidden to be shown
    hiddenImgEl.src = newBackground;
    hiddenImgEl.removeAttribute("hidden");

    // Setting the shown to be hidden
    activeImgEl.setAttribute("hidden", true);
  }
}

function changeBackground() {
  const currentBackgroundEl = getActiveBackgroundImg();

  if (currentBackgroundEl && currentBackgroundEl.src) {
    const backgroundParts = currentBackgroundEl.src.split("/");
    const currentBackground = backgroundParts[backgroundParts.length - 1];

    const nextBackground = nextBackgroundName(loadedBackgrounds, currentBackground);

    if (nextBackground) {
      backgroundParts[backgroundParts.length - 1] = nextBackground;
      toggleImageEl(backgroundParts.join("/"));
    }
  }
}

function nextTicket() {
  ticket = advanceTicket(ticket);

  changeBackground();
  ticketNumber.innerText = ticket;
}

document.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") {
    nextTicket();
  }
});
