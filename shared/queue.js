// Pure queue logic, loaded as a plain script by the renderer and required by main.js and tests.
const MAX_TICKET_NUM = 99;

function advanceTicket(ticket) {
  return ticket >= MAX_TICKET_NUM ? 1 : ticket + 1;
}

function nextBackgroundName(backgrounds, current) {
  if (backgrounds.length === 0) return undefined;
  const index = backgrounds.indexOf(current);
  return backgrounds[(index + 1) % backgrounds.length];
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(name) && !name.startsWith(".");
}

if (typeof module !== "undefined") {
  module.exports = { MAX_TICKET_NUM, advanceTicket, nextBackgroundName, isImageFile };
}
