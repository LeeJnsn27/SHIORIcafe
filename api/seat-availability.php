<?php

header("Content-Type: application/json");

$date = trim($_GET["date"] ?? "");
$startTime = trim($_GET["startTime"] ?? "");
$endTime = trim($_GET["endTime"] ?? "");
$seatName = trim($_GET["seatName"] ?? "");

$dateValue = DateTime::createFromFormat("Y-m-d", $date);
$startValue = DateTime::createFromFormat("H:i", $startTime);
$endValue = DateTime::createFromFormat("H:i", $endTime);

if (!$dateValue || $dateValue->format("Y-m-d") !== $date ||
    !$startValue || $startValue->format("H:i") !== $startTime ||
    !$endValue || $endValue->format("H:i") !== $endTime ||
    $endValue <= $startValue) {
    http_response_code(400);
    echo json_encode(["error" => "Choose a valid date and time range."]);
    exit;
}

try {
    require_once __DIR__ . "/db.php";

    $statement = $pdo->prepare(
                "SELECT seats.seat_name
                 FROM reservations
                 INNER JOIN seats ON seats.id = reservations.seat_id
         WHERE reservation_date = :reservation_date
           AND reservation_start_time < :reservation_end_time
           AND reservation_end_time > :reservation_start_time"
    );
    $statement->execute([
        "reservation_date" => $date,
        "reservation_start_time" => $startTime,
        "reservation_end_time" => $endTime
    ]);

    $occupiedSeats = $statement->fetchAll(PDO::FETCH_COLUMN);
    $availability = [
        "conflict" => false,
        "nextAvailableStart" => null,
        "nextAvailableEnd" => null
    ];

    if ($seatName !== "") {
        $seatStatement = $pdo->prepare(
            "SELECT reservation_start_time, reservation_end_time
             FROM reservations
             WHERE seat_id = (SELECT id FROM seats WHERE seat_name = :seat_name LIMIT 1)
               AND reservation_date = :reservation_date
             ORDER BY reservation_start_time"
        );
        $seatStatement->execute([
            "seat_name" => $seatName,
            "reservation_date" => $date
        ]);
        $reservations = $seatStatement->fetchAll();
        $availability["conflict"] = in_array($seatName, $occupiedSeats, true);

        if ($availability["conflict"]) {
            $requestedDuration = strtotime($endTime) - strtotime($startTime);
            $candidate = strtotime($endTime);

            foreach ($reservations as $reservation) {
                $reservedStart = strtotime($reservation["reservation_start_time"]);
                $reservedEnd = strtotime($reservation["reservation_end_time"]);

                if ($candidate + $requestedDuration <= $reservedStart) {
                    break;
                }

                if ($candidate < $reservedEnd) {
                    $candidate = $reservedEnd;
                }
            }

            $availability["nextAvailableStart"] = date("H:i", $candidate);
            $availability["nextAvailableEnd"] = date("H:i", $candidate + $requestedDuration);
        }
    }

    echo json_encode([
        "success" => true,
        "occupiedSeats" => $occupiedSeats,
        "availability" => $availability
    ]);
} catch (PDOException $exception) {
    http_response_code(500);
    echo json_encode(["error" => "Seat availability could not be loaded."]);
}
