// Pure queue logic, loaded as a plain script by the renderer and required by main.js and tests.
const MAX_TICKET_NUM = 99;

function advanceTicket(ticket) {
  return ticket >= MAX_TICKET_NUM ? 1 : ticket + 1;
}

function previousTicket(ticket) {
  return ticket <= 1 ? MAX_TICKET_NUM : ticket - 1;
}

// Accepts a number or a digit string (e.g. from an input field); null if not a whole number in 1..99.
function parseTicket(value) {
  const number = typeof value === "string" && /^\s*\d+\s*$/.test(value) ? Number(value) : value;
  return Number.isInteger(number) && number >= 1 && number <= MAX_TICKET_NUM ? number : null;
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
  module.exports = {
    MAX_TICKET_NUM,
    advanceTicket,
    previousTicket,
    parseTicket,
    nextBackgroundName,
    isImageFile,
  };
}
