// SHIORI Café — chat.js
// AI study companion chat logic for about.html
//
// Tries the real backend first (api/chat.php, which calls Gemini).
// If that fails for any reason — opened via file://, XAMPP not running, no internet —
// it quietly falls back to a local canned reply so the chat still feels alive.

$(document).ready(function () {

    // offline fallback replies, used only when the backend call fails
    let studyReplies = [
        "That's a great question — take it one small step at a time. You've got this.",
        "Nice! Try breaking that into three smaller parts, and tackle just the first one for now.",
        "Remember to breathe. A five-minute stretch might help this click into place.",
        "You're doing better than you think. Want to try explaining it back to me in your own words?",
        "Let's slow down together. Re-read the tricky part once more, gently, without rushing."
    ];

    // scrolls the chat log so the newest message is always visible
    function scrollChatToBottom() {
        $("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
    }

    function sendChatMessage() {
        let studentText = $("#chat-input").val();

        if (studentText.trim() === "") {
            return;
        }

        // show the student's own message right away
        let studentBubble = $("<div>")
            .addClass("chat-bubble chat-bubble-student")
            .text(studentText);
        $("#chat-messages").append(studentBubble);
        $("#chat-input").val("");
        scrollChatToBottom();

        // a temporary "Thinking..." bubble while we wait for the real reply.
        // the "thinking-bubble" class is how we find and replace it once the reply arrives.
        let thinkingBubble = $("<div>")
            .addClass("chat-bubble chat-bubble-ai thinking-bubble")
            .text("Thinking...");
        $("#chat-messages").append(thinkingBubble);
        $("#chat-send-btn").prop("disabled", true).text("Thinking...");
        scrollChatToBottom();

        // ask our PHP backend (api/chat.php), which asks Gemini on our behalf
        $.ajax({
            url: "api/chat.php",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ message: studentText }),
            dataType: "json",

            // the backend answered successfully — swap "Thinking..." for the real reply
            success: function (responseData) {
                $(".thinking-bubble").last().removeClass("thinking-bubble").text(responseData.reply);
                scrollChatToBottom();
            },

            // the request failed — this happens if the page was opened via file://,
            // XAMPP isn't running, or there's no network connection at all.
            // instead of showing an error, we quietly fall back to a canned reply.
            error: function (xhr) {
                let errorMessage = xhr.responseJSON?.error;

                if (errorMessage) {
                    $(".thinking-bubble").last().removeClass("thinking-bubble").text("AI error: " + errorMessage);
                    scrollChatToBottom();
                    return;
                }

                setTimeout(function () {
                    let randomIndex = Math.floor(Math.random() * studyReplies.length);
                    let chosenReply = studyReplies[randomIndex];

                    $(".thinking-bubble").last().removeClass("thinking-bubble").text("Offline suggestion: " + chosenReply);
                    scrollChatToBottom();
                }, 500);
            },
            complete: function () {
                $("#chat-send-btn").prop("disabled", false).text("Send");
            }
        });
    }

    $("#chat-send-btn").on("click", function () {
        sendChatMessage();
    });

    $("#chat-input").on("keypress", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            sendChatMessage();
        }
    });

});