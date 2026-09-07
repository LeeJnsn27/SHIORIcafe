<?php

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["error" => "Only POST requests are allowed."]);
    exit;
}

$request = json_decode(file_get_contents("php://input"), true);
$tableNumber = trim($request["tableNumber"] ?? "");
$paymentMethod = trim($request["paymentMethod"] ?? "");
$receiptEmail = trim($request["receiptEmail"] ?? "");
$items = $request["items"] ?? [];

$menuPrices = [
    "Hojicha Latte" => 150.00,
    "Spanish Latte" => 140.00,
    "Matcha" => 160.00,
    "Castella Cake" => 120.00,
    "Genmaicha" => 130.00,
    "Yuzu Honey Tea" => 135.00,
    "Dorayaki" => 110.00,
    "Onigiri" => 95.00
];
$validPaymentMethods = ["Cash on Table", "GCash", "Debit / Credit Card"];

if ($tableNumber === "" || $paymentMethod === "" || !in_array($paymentMethod, $validPaymentMethods, true)) {
    http_response_code(400);
    echo json_encode(["error" => "Table number and a valid payment method are required."]);
    exit;
}

if ($receiptEmail !== "" && !filter_var($receiptEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(["error" => "Please provide a valid email address."]);
    exit;
}

if (!is_array($items) || count($items) === 0) {
    http_response_code(400);
    echo json_encode(["error" => "Add at least one item before confirming."]);
    exit;
}

$validatedItems = [];
$total = 0.00;

foreach ($items as $item) {
    $itemName = trim($item["name"] ?? "");
    $quantity = filter_var($item["quantity"] ?? 0, FILTER_VALIDATE_INT);

    if (!array_key_exists($itemName, $menuPrices) || $quantity < 1) {
        http_response_code(400);
        echo json_encode(["error" => "That menu item or quantity is not valid."]);
        exit;
    }

    $itemPrice = $menuPrices[$itemName];
    $validatedItems[] = ["name" => $itemName, "price" => $itemPrice, "quantity" => $quantity];
    $total += $itemPrice * $quantity;
}

try {
    require_once __DIR__ . "/db.php";
    $pdo->beginTransaction();

    $orderStatement = $pdo->prepare(
        "INSERT INTO orders (table_number, payment_method, receipt_email, total)
         VALUES (:table_number, :payment_method, :receipt_email, :total)"
    );
    $orderStatement->execute([
        "table_number" => $tableNumber,
        "payment_method" => $paymentMethod,
        "receipt_email" => $receiptEmail !== "" ? $receiptEmail : null,
        "total" => $total
    ]);

    $orderId = $pdo->lastInsertId();
    $itemStatement = $pdo->prepare(
        "INSERT INTO order_items (order_id, item_name, price, quantity)
         VALUES (:order_id, :item_name, :price, :quantity)"
    );

    foreach ($validatedItems as $item) {
        $itemStatement->execute([
            "order_id" => $orderId,
            "item_name" => $item["name"],
            "price" => $item["price"],
            "quantity" => $item["quantity"]
        ]);
    }

    $pdo->commit();
    echo json_encode(["success" => true, "orderId" => $orderId, "total" => $total]);
} catch (PDOException $exception) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode(["error" => "The order could not be saved."]);
}
