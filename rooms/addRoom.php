<?php
declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';

$input = json_decode(file_get_contents('php://input'), true);

$pdo = get_pdo();
$status = $input['status'] ?? 'Available';

try {

    if (empty($input['room_number'])) {
        respond_json(400, ['success' => false, 'message' => 'Room number is required']);
    }

    if (empty($input['room_type']) && empty($input['room_type_id'])) {
        respond_json(400, ['success' => false, 'message' => 'Room type is required']);
    }

    $roomTypeId = null;

    if (!empty($input['room_type_id'])) {
        $roomTypeId = intval($input['room_type_id']);
        $stmt = $pdo->prepare("SELECT room_type_id FROM room_types WHERE room_type_id = ?");
        $stmt->execute([$roomTypeId]);
        if (!$stmt->fetch()) {
            respond_json(400, ['success' => false, 'message' => 'Invalid room type selected']);
        }
    } else {
        $roomTypeName = sanitize_string($input['room_type']);
        $stmt = $pdo->prepare("SELECT room_type_id FROM room_types WHERE type_name = ?");
        $stmt->execute([$roomTypeName]);
        $roomType = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($roomType) {
            $roomTypeId = intval($roomType['room_type_id']);
        } else {
            $stmt = $pdo->prepare("
                INSERT INTO room_types (type_name, price_per_night, capacity_adults, capacity_children)
                VALUES (?, ?, ?, ?)
            ");
            $stmt->execute([
                $roomTypeName,
                intval($input['price_per_night'] ?? 0),
                intval($input['capacity_adults'] ?? 0),
                intval($input['capacity_children'] ?? 0)
            ]);
            $roomTypeId = intval($pdo->lastInsertId());
        }
    }

    // Duplicate check
    $check = $pdo->prepare("
        SELECT room_id 
        FROM rooms 
        WHERE room_number = ? 
        AND room_type_id = ?
    ");
    $check->execute([sanitize_string($input['room_number']), $roomTypeId]);
    if ($check->fetch()) {
        respond_json(409, [
            'success' => false,
            'message' => 'Room number already exists for this room type.'
        ]);
    }

    // Insert room
    $stmt = $pdo->prepare("
        INSERT INTO rooms (room_number, room_type_id, status)
        VALUES (?, ?, ?)
    ");
    $stmt->execute([
        sanitize_string($input['room_number']),
        $roomTypeId,
        ucfirst(strtolower($status))
    ]);

    respond_json(200, ['success' => true, 'message' => 'Room added successfully']);
} catch (PDOException $e) {
    respond_json(500, ['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
