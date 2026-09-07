// SHIORI Café — reservation.js
// seat availability map + reservation form logic for contact.html
// depends on cafeEmail, defined in app.js (loaded before this file)

$(document).ready(function () {

    // holds the last confirmed reservation, since the form itself gets cleared right after confirming
    let lastReservation = { guestName: "", seat: "", date: "", startTime: "", endTime: "", email: "" };
    let selectedSeatConflict = false;
    let availabilityRequest = null;
    let availabilityRequestId = 0;

    function formatTime(date) {
        return String(date.getHours()).padStart(2, "0") + ":" + String(date.getMinutes()).padStart(2, "0");
    }

    function formatDate(date) {
        return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") +
               "-" + String(date.getDate()).padStart(2, "0");
    }

    function formatDisplayTime(timeValue) {
        let timeParts = timeValue.split(":");
        let hours = Number(timeParts[0]);
        let minutes = timeParts[1];
        let period = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        return hours + ":" + minutes + " " + period;
    }

    function addHour(timeValue) {
        let timeParts = timeValue.split(":");
        let date = new Date(2000, 0, 1, Number(timeParts[0]), Number(timeParts[1]));
        date.setHours(date.getHours() + 1);
        return formatTime(date);
    }

    let now = new Date();
    let today = formatDate(now);
    let currentTime = formatTime(now);
    let defaultEnd = new Date(now.getTime() + 60 * 60 * 1000);

    $("#reservation-date").attr("min", today);
    $("#reservation-start-time").val(currentTime).attr("min", currentTime);
    $("#reservation-end-time").val(formatTime(defaultEnd));

    $("#reservation-date").on("change", function () {
        if ($(this).val() === today) {
            $("#reservation-start-time").attr("min", currentTime);
        } else {
            $("#reservation-start-time").removeAttr("min");
        }
        loadSeatAvailability();
    });

    $("#reservation-start-time").on("change", function () {
        let startTime = $(this).val();
        let endTime = $("#reservation-end-time").val();

        $("#reservation-end-time").attr("min", startTime);
        if (startTime && (!endTime || endTime <= startTime)) {
            $("#reservation-end-time").val(addHour(startTime));
        }

        loadSeatAvailability();
    });

    $("#reservation-end-time").on("change", function () {
        let startTime = $("#reservation-start-time").val();
        if (startTime) {
            $(this).attr("min", startTime);
        }
        loadSeatAvailability();
    });

    function loadSeatAvailability() {
        let reservationDate = $("#reservation-date").val();
        let reservationStartTime = $("#reservation-start-time").val();
        let reservationEndTime = $("#reservation-end-time").val();
        let selectedSeat = $("#selected-seat").val();

        $("#reservation-availability").addClass("d-none").text("");
        $("#use-suggested-time").addClass("d-none").removeData("start-time").removeData("end-time");
        $(".seat-btn").removeClass("seat-occupied").prop("disabled", false);

        if (!reservationDate || !reservationStartTime || !reservationEndTime || reservationEndTime <= reservationStartTime) {
            selectedSeatConflict = false;
            return;
        }

        if (availabilityRequest) {
            availabilityRequest.abort();
        }

        let requestId = ++availabilityRequestId;
        availabilityRequest = $.getJSON(apiFile("seat-availability", "seat-availability.php"), {
            date: reservationDate,
            startTime: reservationStartTime,
            endTime: reservationEndTime,
            seatName: selectedSeat
        }).done(function (responseData) {
            if (requestId !== availabilityRequestId) {
                return;
            }

            let occupiedSeats = responseData.occupiedSeats || [];
            let availability = responseData.availability || {};
            selectedSeatConflict = availability.conflict === true;

            $(".seat-btn").each(function () {
                let seatButton = $(this);
                let isOccupied = occupiedSeats.includes(seatButton.data("seat"));
                seatButton.removeClass("seat-occupied seat-selected")
                    .toggleClass("seat-occupied", isOccupied)
                    .prop("disabled", false);

            });

            if (selectedSeat && !availability.conflict) {
                $(".seat-btn[data-seat='" + selectedSeat + "']").addClass("seat-selected");
            }

            if (availability.conflict && availability.nextAvailableStart && availability.nextAvailableEnd) {
                $("#reservation-availability").removeClass("d-none")
                    .text(selectedSeat + " is booked for this time. Next available: " +
                          formatDisplayTime(availability.nextAvailableStart) + " to " +
                          formatDisplayTime(availability.nextAvailableEnd) + ".");
                $("#use-suggested-time")
                    .removeClass("d-none")
                    .data("start-time", availability.nextAvailableStart)
                    .data("end-time", availability.nextAvailableEnd);
            } else if (selectedSeat) {
                $("#reservation-availability").addClass("d-none").text("");
            }
        }).fail(function (xhr) {
            if (xhr.statusText === "abort" || requestId !== availabilityRequestId) {
                return;
            }
            selectedSeatConflict = false;
            $(".seat-btn").removeClass("seat-occupied").prop("disabled", false);
            let details = xhr.responseJSON?.details || xhr.responseJSON?.error;
            $("#reservation-availability").removeClass("d-none")
                .text(details || "Availability could not be checked. Please refresh the page and try again.");
        }).always(function () {
            if (requestId === availabilityRequestId) {
                availabilityRequest = null;
            }
        });
    }

    loadSeatAvailability();

    // tapping an available seat selects it; occupied seats are disabled and can't be clicked
    $(".seat-btn").on("click", function () {
        $(".seat-btn").removeClass("seat-selected");
        $(this).addClass("seat-selected");

        let seatName = $(this).data("seat");
        selectedSeatConflict = false;
        $("#selected-seat").val(seatName);
        $("#selected-seat-display").text(seatName + " selected");
        loadSeatAvailability();
    });

    $("#use-suggested-time").on("click", function () {
        let suggestedStart = $(this).data("start-time");
        let suggestedEnd = $(this).data("end-time");

        $("#reservation-start-time").val(suggestedStart);
        $("#reservation-end-time").val(suggestedEnd);
        loadSeatAvailability();
    });

    $("#reservation-form").on("submit", function (event) {
        event.preventDefault(); // stop page reload

        let guestName = $("#guest-name").val();
        let reservationDate = $("#reservation-date").val();
        let reservationStartTime = $("#reservation-start-time").val();
        let reservationEndTime = $("#reservation-end-time").val();
        let selectedSeat = $("#selected-seat").val();
        let guestEmail = $("#guest-email").val();

        if (reservationDate < today) {
            $("#reservation-availability").removeClass("d-none").text("Please choose today or a future date.");
            return;
        }

        if (reservationStartTime === "" || reservationEndTime === "") {
            $("#reservation-availability").removeClass("d-none").text("Please choose a start and end time.");
            return;
        }

        if (reservationEndTime <= reservationStartTime) {
            $("#reservation-availability").removeClass("d-none").text("End time must be later than start time.");
            return;
        }

        if (selectedSeat === "") {
            $("#reservation-availability").removeClass("d-none").text("Please tap a seat above before confirming.");
            return;
        }

        let selectedSeatButton = $(".seat-btn.seat-selected");
        if (selectedSeatConflict || selectedSeatButton.hasClass("seat-occupied")) {
            $("#reservation-availability").removeClass("d-none")
                .text("That seat is already booked for this time. Please choose another time or seat.");
            return;
        }

        $("#reservation-availability").addClass("d-none");

        let submitButton = $(this).find("button[type='submit']");
        submitButton.prop("disabled", true).text("Saving...");

        $.ajax({
            url: apiFile("create-reservation", "create-reservation.php"),
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                guestName: guestName,
                guestEmail: guestEmail,
                seatName: selectedSeat,
                reservationDate: reservationDate,
                reservationStartTime: reservationStartTime,
                reservationEndTime: reservationEndTime
            }),
            success: function () {
                let detailsText = guestName + " has reserved " + selectedSeat +
                                   " on " + reservationDate + " from " + formatDisplayTime(reservationStartTime) +
                                   " to " + formatDisplayTime(reservationEndTime) + ".";

                $("#confirmation-details").text(detailsText);
                $("#confirmation-banner").removeClass("d-none").hide().slideDown(400);

                lastReservation = {
                    guestName: guestName,
                    seat: selectedSeat,
                    date: reservationDate,
                    startTime: reservationStartTime,
                    endTime: reservationEndTime,
                    email: guestEmail
                };

                $(".seat-btn.seat-selected")
                    .removeClass("seat-selected")
                    .addClass("seat-occupied")
                    .prop("disabled", true);

                $("#reservation-form")[0].reset();
                $("#selected-seat").val("");
                $("#selected-seat-display").text("No seat selected yet — tap one above.");
            },
            error: function (xhr) {
                let errorMessage = xhr.responseJSON?.details || xhr.responseJSON?.error;
                if (!errorMessage && xhr.responseText) {
                    errorMessage = xhr.responseText.substring(0, 300);
                }
                if (!errorMessage) {
                    errorMessage = "The reservation could not be saved. HTTP status: " + xhr.status;
                }
                $("#reservation-availability").removeClass("d-none").text(errorMessage);
            },
            complete: function () {
                submitButton.prop("disabled", false).text("Confirm Reservation");
            }
        });
    });

    // builds one plain-text reservation receipt, reused by both buttons below
    function buildReservationReceipt() {
        let receiptText = "SHIORI Cafe - Reservation Receipt\n";
        receiptText = receiptText + "Guest: " + lastReservation.guestName + "\n";
        receiptText = receiptText + "Seat: " + lastReservation.seat + "\n";
        receiptText = receiptText + "Date: " + lastReservation.date + "\n";
        receiptText = receiptText + "Start Time: " + formatDisplayTime(lastReservation.startTime) + "\n";
        receiptText = receiptText + "End Time: " + formatDisplayTime(lastReservation.endTime) + "\n";

        return receiptText;
    }

    // opens Gmail's compose window, pre-filled with the reservation
    $("#email-reservation-btn").on("click", function () {
        let receiptText = buildReservationReceipt();

        let gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1" +
                        "&to=" + encodeURIComponent(cafeEmail) +
                        "&su=" + encodeURIComponent("New Nook Reservation") +
                        "&body=" + encodeURIComponent(receiptText);

        if (lastReservation.email.trim() !== "") {
            gmailUrl = gmailUrl + "&cc=" + encodeURIComponent(lastReservation.email);
        }

        window.open(gmailUrl, "_blank");
    });

    // downloads the reservation receipt as a .txt file
    $("#download-reservation-btn").on("click", function () {
        let receiptText = buildReservationReceipt();
        let receiptBlob = new Blob([receiptText], { type: "text/plain" });
        let downloadUrl = URL.createObjectURL(receiptBlob);

        let tempLink = document.createElement("a");
        tempLink.href = downloadUrl;
        tempLink.download = "SHIORI-Cafe-Reservation.txt";
        tempLink.click();

        URL.revokeObjectURL(downloadUrl);
    });

});