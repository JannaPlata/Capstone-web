<?php
declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';

$input = json_input();

file_put_contents("debug_update.txt", json_encode($input, JSON_PRETTY_PRINT));


// Validate required field
required($input, ['room_id']);

$pdo = get_pdo();

$updates = [];
$params = [];

// Room number
if (isset($input['room_number'])) {
    $updates[] = "room_number = ?";
    $params[] = sanitize_string($input['room_number']);
}

// Room type (map to ID)
if (isset($input['room_type_id'])) {
    $updates[] = "room_type_id = ?";
    $params[] = intval($input['room_type_id']);
}

// Status
if (isset($input['status'])) {
    $updates[] = "status = ?";
    $params[] = ucfirst(strtolower($input['status']));
}

if (empty($updates)) {
    respond_json(400, ['success' => false, 'message' => 'Nothing to update']);
}

$params[] = intval($input['room_id']);
$sql = "UPDATE rooms SET " . implode(", ", $updates) . " WHERE room_id = ?";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    respond_json(200, ['success' => true, 'message' => 'Room updated successfully']);
} catch (PDOException $e) {
    respond_json(500, ['success' => false, 'message' => $e->getMessage()]);
}