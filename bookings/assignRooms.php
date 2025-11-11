<?php
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';
header('Content-Type: application/json');

$raw = file_get_contents('php://input');
$data = null;
if (!empty($raw)) {
    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $data = $decoded;
    }
}
if (!$data && !empty($_POST)) {
    $data = $_POST;
}
if (!$data) respond_json(400, ['success'=>false,'message'=>'Missing room assignment data']);

$booking_id = $data['booking_id'] ?? null;
$room_ids = $data['rooms'] ?? null;
if (!$booking_id || !$room_ids || !is_array($room_ids) || count($room_ids) === 0) {
    respond_json(400, ['success'=>false, 'message'=>'Must supply booking_id and rooms (array of room_id)']);
}

try {
    $pdo = get_pdo();
    $pdo->beginTransaction();
    // Confirm booking exists
    $stmt = $pdo->prepare('SELECT * FROM bookings WHERE booking_id = ?');
    $stmt->execute([$booking_id]);
    $booking = $stmt->fetch();
    if (!$booking) throw new Exception('Booking not found');
    // Look up all already-assigned rooms to this booking
    $assignedRooms = [];
    $res = $pdo->prepare('SELECT room_id FROM booking_rooms WHERE booking_id = ?');
    $res->execute([$booking_id]);
    foreach ($res->fetchAll() as $row) $assignedRooms[] = (int)$row['room_id'];
    // Assign each requested room
    foreach ($room_ids as $room_id) {
        $room_id = (int)$room_id;
        if ($room_id < 1) continue;
        if (in_array($room_id, $assignedRooms)) continue;
        // Check room is available
        $room = $pdo->prepare('SELECT status FROM rooms WHERE room_id = ? FOR UPDATE');
        $room->execute([$room_id]);
        $roomData = $room->fetch();
        if (!$roomData || strtolower($roomData['status']) !== 'available') {
            throw new Exception('Room not available: ' . $room_id);
        }
        // Assign it (avoid duplicate rows)
        $ins = $pdo->prepare('INSERT IGNORE INTO booking_rooms (booking_id, room_id, assigned_at) VALUES (?, ?, NOW())');
        $ins->execute([$booking_id, $room_id]);
        // Mark room as booked
        $upd = $pdo->prepare('UPDATE rooms SET status = ? WHERE room_id = ?');
        $upd->execute(['Booked', $room_id]);
    }
    // Update booking status/payment if not yet confirmed
    if (!in_array(strtolower($booking['status']), ['confirmed','checked-in','checked-out'])) {
        $pdo->prepare('UPDATE bookings SET status = ?, payment_status = ? WHERE booking_id = ?')->execute(['confirmed','reserved',$booking_id]);
    }
    $pdo->commit();
    respond_json(200, ['success'=>true,'booking_id'=>$booking_id]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    respond_json(500, ['success'=>false,'message'=>'Failed to assign rooms','error'=>$e->getMessage()]);
}