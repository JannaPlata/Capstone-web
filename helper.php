<?php
declare(strict_types=1);

// Allow requests from your frontend (dev ports can vary: 5173, 5174, etc.)
// For development, we allow all origins. Tighten this in production.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}


// Read JSON input from frontend
function json_input(): array {
    $data = file_get_contents('php://input');

    // Debug: log raw input
    error_log("RAW INPUT: " . $data);

    if (!$data) {
        respond_json(400, ['success' => false, 'message' => 'Empty request body']);
    }

    $decoded = json_decode($data, true);
    if ($decoded === null) {
        respond_json(400, ['success' => false, 'message' => 'Invalid JSON']);
    }

    return $decoded;
}



// Send JSON response
if (!function_exists('respond_json')) {
    function respond_json(int $statusCode, array $data): void {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}


// Sanitize string input
function sanitize_string(string $str): string {
    return trim(htmlspecialchars($str, ENT_QUOTES, 'UTF-8'));
}

// Check required keys in input array
function required(array $input, array $keys): array {
    foreach ($keys as $key) {
        if (!array_key_exists($key, $input)) {
            respond_json(400, ['success' => false, 'message' => "Missing required field: $key"]);
        }
    }
    return $input;
}
