<?php
require_once __DIR__ . '/../../db.php';

try {
    $pdo = get_pdo();
    $data = json_decode(file_get_contents("php://input"), true);

    $booking_id = $data['booking_id'] ?? null;
    $room_id = $data['room_id'] ?? null;

    if (!$booking_id || !$room_id) {
        respond_json(400, ['success' => false, 'message' => 'Missing booking_id or room_id']);
    }

    $pdo->beginTransaction();

    // Insert into booking_rooms
    $stmt = $pdo->prepare("INSERT INTO booking_rooms (booking_id, room_id, assigned_at) VALUES (?, ?, NOW())");
    $stmt->execute([$booking_id, $room_id]);

    // Update room status to Booked
    $stmt = $pdo->prepare("UPDATE rooms SET status = 'Booked' WHERE room_id = ?");
    $stmt->execute([$room_id]);

    // Update booking payment_status to Reserved (partial payment)
    $stmt = $pdo->prepare("UPDATE bookings SET payment_status = 'Reserved' WHERE booking_id = ?");
    $stmt->execute([$booking_id]);

    $pdo->commit();

    respond_json(200, ['success' => true, 'message' => 'Room assigned successfully']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    respond_json(500, ['success' => false, 'message' => 'Failed to assign room', 'error' => $e->getMessage()]);
}