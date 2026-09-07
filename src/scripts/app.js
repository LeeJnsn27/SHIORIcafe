// SHIORI Café — app.js
// shared values used by more than one page's script.
// this file must load BEFORE order.js and reservation.js, since they both use cafeEmail below.

// café's own inbox — receipts and reservations are emailed here
let cafeEmail = "hello@shioricafe.com";

let isLocalServer = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
let apiFile = function (name, localFile) {
	return isLocalServer ? "api/" + localFile : "api/" + name;
};