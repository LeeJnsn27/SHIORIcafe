<?php

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["error" => "Only POST requests are allowed."]);
    exit;
}

$request = json_decode(file_get_contents("php://input"), true);
$guestName = trim($request["guestName"] ?? "");
$guestEmail = trim($request["guestEmail"] ?? "");
$seatName = trim($request["seatName"] ?? "");
$reservationDate = trim($request["reservationDate"] ?? "");
$reservationStartTime = trim($request["reservationStartTime"] ?? "");
$reservationEndTime = trim($request["reservationEndTime"] ?? "");

if ($guestName === "" || $seatName === "" || $reservationDate === "" || $reservationStartTime === "" || $reservationEndTime === "") {
    http_response_code(400);
    echo json_encode(["error" => "Name, seat, date, and time are required."]);
    exit;
}

if ($guestEmail !== "" && !filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Please provide a valid email address."]);
    exit;
}

$date = DateTime::createFromFormat("Y-m-d", $reservationDate);
$startTime = DateTime::createFromFormat("H:i", $reservationStartTime);
$endTime = DateTime::createFromFormat("H:i", $reservationEndTime);
$today = new DateTime("today");

if (!$date || $date->format("Y-m-d") !== $reservationDate || $date < $today) {
    http_response_code(400);
    echo json_encode(["error" => "Please choose today or a future date."]);
    exit;
}

if (!$startTime || $startTime->format("H:i") !== $reservationStartTime ||
    !$endTime || $endTime->format("H:i") !== $reservationEndTime) {
    http_response_code(400);
    echo json_encode(["error" => "Please provide valid reservation times."]);
    exit;
}

if ($endTime <= $startTime) {
    http_response_code(400);
    echo json_encode(["error" => "End time must be later than start time."]);
    exit;
}

try {
    require_once __DIR__ . "/db.php";

    $seatStatement = $pdo->prepare(
        "SELECT id FROM seats WHERE seat_name = :seat_name AND is_active = TRUE"
    );
    $seatStatement->execute(["seat_name" => $seatName]);
    $seat = $seatStatement->fetch();

    if (!$seat) {
        http_response_code(400);
        echo json_encode(["error" => "That seat is not available."]);
        exit;
    }

    $overlapStatement = $pdo->prepare(
        "SELECT id FROM reservations
         WHERE seat_id = :seat_id
           AND reservation_date = :reservation_date
           AND reservation_start_time < :reservation_end_time
           AND reservation_end_time > :reservation_start_time
         LIMIT 1"
    );
    $overlapStatement->execute([
        "seat_id" => $seat["id"],
        "reservation_date" => $reservationDate,
        "reservation_start_time" => $reservationStartTime,
        "reservation_end_time" => $reservationEndTime
    ]);

    if ($overlapStatement->fetch()) {
        $nextTimeStatement = $pdo->prepare(
            "SELECT reservation_end_time FROM reservations
             WHERE seat_id = :seat_id AND reservation_date = :reservation_date
             ORDER BY reservation_end_time DESC LIMIT 1"
        );
        $nextTimeStatement->execute([
            "seat_id" => $seat["id"],
            "reservation_date" => $reservationDate
        ]);
        $nextStart = $nextTimeStatement->fetchColumn();
        $durationSeconds = strtotime($reservationEndTime) - strtotime($reservationStartTime);
        $nextEnd = $nextStart ? date("H:i", strtotime($nextStart) + $durationSeconds) : null;

        http_response_code(409);
        echo json_encode([
            "error" => "That seat is already reserved during part of this time range.",
            "details" => $nextStart && $nextEnd
                ? "Next suggested time: " . date("H:i", strtotime($nextStart)) . " to " . $nextEnd . "."
                : "Please choose another time."
        ]);
        exit;
    }

    $reservationStatement = $pdo->prepare(
        "INSERT INTO reservations
                (guest_name, guest_email, seat_id, reservation_date, reservation_start_time, reservation_end_time)
         VALUES
                (:guest_name, :guest_email, :seat_id, :reservation_date, :reservation_start_time, :reservation_end_time)"
    );
    $reservationStatement->execute([
        "guest_name" => $guestName,
        "guest_email" => $guestEmail !== "" ? $guestEmail : null,
        "seat_id" => $seat["id"],
        "reservation_date" => $reservationDate,
        "reservation_start_time" => $reservationStartTime,
        "reservation_end_time" => $reservationEndTime
    ]);

    echo json_encode([
        "success" => true,
        "reservationId" => $pdo->lastInsertId()
    ]);
} catch (PDOException $exception) {
    if ($exception->getCode() === "23000") {
        http_response_code(409);
        echo json_encode(["error" => "That seat has already been reserved for this date and time."]);
        exit;
    }

    http_response_code(500);
    echo json_encode(["error" => "The reservation could not be saved."]);
}
