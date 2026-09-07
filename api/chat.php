<?php
// This endpoint keeps the Gemini API key on the server.

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["error" => "Only POST requests are allowed."]);
    exit;
}

$request = json_decode(file_get_contents("php://input"), true);
$message = trim($request["message"] ?? "");
$apiKey = getenv("GEMINI_API_KEY");

if ($message === "") {
    http_response_code(400);
    echo json_encode(["error" => "A message is required."]);
    exit;
}

if (!$apiKey) {
    http_response_code(500);
    echo json_encode(["error" => "The GEMINI_API_KEY environment variable is not configured."]);
    exit;
}

$model = getenv("GEMINI_MODEL") ?: "gemini-3.6-flash";
if ($model === "gemini-2.5-flash") {
    $model = "gemini-3.6-flash";
}
$payload = json_encode([
    "system_instruction" => [
        "parts" => [[
            "text" => "You are a warm, concise study companion for a quiet cafe. Help students think through questions without doing dishonest academic work for them."
        ]]
    ],
    "contents" => [[
        "role" => "user",
        "parts" => [["text" => $message]]
    ]],
    "generationConfig" => ["maxOutputTokens" => 250]
]);

$endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" . rawurlencode($model) . ":generateContent";
$curl = curl_init($endpoint);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "x-goog-api-key: " . $apiKey
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30
]);

$rawResponse = curl_exec($curl);
$httpStatus = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

if ($rawResponse === false || $curlError) {
    http_response_code(502);
    echo json_encode(["error" => "The AI service could not be reached."]);
    exit;
}

$response = json_decode($rawResponse, true);

if ($httpStatus < 200 || $httpStatus >= 300) {
    http_response_code(502);
    $serviceError = $response["error"]["message"] ?? "No details were returned by Gemini.";
    echo json_encode([
        "error" => "The AI service rejected the request."
    ]);
    exit;
}

$reply = $response["candidates"][0]["content"]["parts"][0]["text"] ?? "I could not create a reply this time.";
echo json_encode(["reply" => $reply]);