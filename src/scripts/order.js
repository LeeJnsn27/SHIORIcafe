// SHIORI Café — order.js
// table ordering logic for services.html
// depends on cafeEmail, defined in app.js (loaded before this file)

$(document).ready(function () {

    let runningTotal = 0;

    $(".add-to-table-btn").on("click", function () {
        let itemName = $(this).data("name");
        let itemPrice = $(this).data("price");
        let existingItem = $("#order-list li[data-name='" + itemName + "']");

        runningTotal = runningTotal + itemPrice;
        $("#empty-order-message").hide();

        if (existingItem.length) {
            let quantity = Number(existingItem.attr("data-quantity")) + 1;
            existingItem.attr("data-quantity", quantity);
            existingItem.find(".quantity-value").text(quantity);
        } else {
            let newListItem = "<li class='list-group-item' data-name='" + itemName + "' data-price='" + itemPrice + "' data-quantity='1'>" +
                                "<span>" + itemName + "</span>" +
                                "<span class='item-right'>" +
                                    "₱" + itemPrice + " x " +
                                    "<button type='button' class='quantity-btn quantity-decrease' aria-label='Decrease " + itemName + " quantity'>−</button>" +
                                    "<span class='quantity-value'>1</span>" +
                                    "<button type='button' class='quantity-btn quantity-increase' aria-label='Increase " + itemName + " quantity'>+</button>" +
                                "</span>" +
                            "</li>";

            $("#order-list").append(newListItem);
        }
        $("#order-total").text(runningTotal);
        hideOrderConfirmation(); // changing the order cancels any old confirmation
    });

    // remove a single item — event delegation, since these buttons don't exist yet on page load
    $("#order-list").on("click", ".quantity-decrease", function () {
        let thisItem = $(this).closest("li");
        let thisPrice = thisItem.data("price");
        let quantity = Number(thisItem.attr("data-quantity"));

        runningTotal = runningTotal - thisPrice;
        quantity = quantity - 1;
        $("#order-total").text(runningTotal);

        if (quantity === 0) {
            thisItem.remove();
        } else {
            thisItem.attr("data-quantity", quantity);
            thisItem.find(".quantity-value").text(quantity);
        }

        if ($("#order-list li").not("#empty-order-message").length === 0) {
            $("#empty-order-message").show();
        }

        hideOrderConfirmation();
    });

    $("#order-list").on("click", ".quantity-increase", function () {
        let thisItem = $(this).closest("li");
        let thisPrice = thisItem.data("price");
        let quantity = Number(thisItem.attr("data-quantity")) + 1;

        runningTotal = runningTotal + thisPrice;
        thisItem.attr("data-quantity", quantity);
        thisItem.find(".quantity-value").text(quantity);
        $("#order-total").text(runningTotal);

        hideOrderConfirmation();
    });

    // cancel the whole order
    $("#cancel-order-btn").on("click", function () {
        $("#order-list li").not("#empty-order-message").remove();
        $("#empty-order-message").show();

        runningTotal = 0;
        $("#order-total").text(runningTotal);

        $("#table-number").val("");
        $("#receipt-email").val("");
        $("input[name='paymentMethod']").prop("checked", false);
        $("#order-warning").addClass("d-none");
        hideOrderConfirmation();
    });

    // confirm the order, after checking there's something to confirm
    $("#confirm-order-btn").on("click", function () {
        let tableNumber = $("#table-number").val();
        let paymentMethod = $("input[name='paymentMethod']:checked").val();

        if (runningTotal === 0) {
            $("#order-warning").removeClass("d-none").text("Add at least one item before confirming.");
            return;
        }

        if (tableNumber.trim() === "") {
            $("#order-warning").removeClass("d-none").text("Please enter your table number.");
            return;
        }

        if (!paymentMethod) {
            $("#order-warning").removeClass("d-none").text("Please choose a payment method.");
            return;
        }

        $("#order-warning").addClass("d-none");

        $("#order-warning").addClass("d-none");

        let confirmButton = $(this);
        confirmButton.prop("disabled", true).text("Saving...");

        $.ajax({
            url: apiFile("create-order", "create-order.php"),
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            data: JSON.stringify({
                tableNumber: tableNumber,
                paymentMethod: paymentMethod,
                receiptEmail: $("#receipt-email").val(),
                items: getOrderItems()
            }),
            success: function (responseData) {
                runningTotal = Number(responseData.total);
                $("#order-total").text(runningTotal.toFixed(2));

                let confirmationText = "Table " + tableNumber + " — total of ₱" + runningTotal.toFixed(2) +
                                        " to be paid via " + paymentMethod + ". Status: Pending. We'll bring it to your table shortly!";
                $("#order-confirmation-details").text(confirmationText);
                $("#order-confirmation-banner").removeClass("d-none").hide().slideDown(400);
            },
            error: function (xhr) {
                let errorMessage = xhr.responseJSON?.details || xhr.responseJSON?.error;
                if (!errorMessage && xhr.responseText) {
                    errorMessage = xhr.responseText.substring(0, 300);
                }
                $("#order-warning").removeClass("d-none").text(errorMessage || "The order could not be saved.");
            },
            complete: function () {
                confirmButton.prop("disabled", false).text("Confirm Order");
            }
        });
    });

    function hideOrderConfirmation() {
        $("#order-confirmation-banner").addClass("d-none");
    }

    // reads every current order item straight from the page, so the receipt always matches what's shown
    function getOrderItems() {
        let items = [];

        $("#order-list li").not("#empty-order-message").each(function () {
            let itemName = $(this).find("span").first().text();
            let itemPrice = $(this).data("price");
            let quantity = Number($(this).attr("data-quantity"));
            items.push({ name: itemName, price: itemPrice, quantity: quantity });
        });

        return items;
    }

    // builds one plain-text receipt, reused by both the email button and the download button
    function buildReceiptText() {
        let tableNumber = $("#table-number").val();
        let paymentMethod = $("input[name='paymentMethod']:checked").val();
        let items = getOrderItems();

        let receiptText = "SHIORI Cafe - Order Receipt\n";
        receiptText = receiptText + "Table Number: " + tableNumber + "\n";
        receiptText = receiptText + "Payment Method: " + paymentMethod + "\n";
        receiptText = receiptText + "------------------------------\n";

        for (let i = 0; i < items.length; i++) {
            receiptText = receiptText + items[i].name + " x " + items[i].quantity + " - ₱" +
                          (items[i].price * items[i].quantity) + "\n";
        }

        receiptText = receiptText + "------------------------------\n";
        receiptText = receiptText + "Total: ₱" + runningTotal + "\n";

        return receiptText;
    }

    // opens Gmail's compose window, pre-filled with the order — the customer just hits send
    $("#email-receipt-btn").on("click", function () {
        let tableNumber = $("#table-number").val();
        let receiptEmail = $("#receipt-email").val();
        let receiptText = buildReceiptText();

        let gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1" +
                        "&to=" + encodeURIComponent(cafeEmail) +
                        "&su=" + encodeURIComponent("New Table Order - Table " + tableNumber) +
                        "&body=" + encodeURIComponent(receiptText);

        // if the student typed their own email, cc them so they get a copy too
        if (receiptEmail.trim() !== "") {
            gmailUrl = gmailUrl + "&cc=" + encodeURIComponent(receiptEmail);
        }

        window.open(gmailUrl, "_blank");
    });

    // builds the receipt into a downloadable .txt file using a Blob (an in-memory file)
    $("#download-receipt-btn").on("click", function () {
        let receiptText = buildReceiptText();
        let receiptBlob = new Blob([receiptText], { type: "text/plain" });
        let downloadUrl = URL.createObjectURL(receiptBlob);

        // a temporary, invisible link is the standard trick to trigger a file download
        let tempLink = document.createElement("a");
        tempLink.href = downloadUrl;
        tempLink.download = "SHIORI-Cafe-Receipt.txt";
        tempLink.click();

        URL.revokeObjectURL(downloadUrl); // frees up memory once the download starts
    });

});