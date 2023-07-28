const ticketNumber = document.getElementById("ticketNumber");
const MAX_TICKET_NUM = 9;
let ticket = 1;

ticketNumber.innerText = ticket;

function nextTicket() {
  if (ticket >= MAX_TICKET_NUM) {
    ticket = 1;
  } else {
    ticket++;
  }

  ticketNumber.innerText = ticket;
}

document.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") {
    nextTicket();
  }
});
