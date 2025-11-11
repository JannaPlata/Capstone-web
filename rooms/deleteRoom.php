<?php
declare(strict_types=1);
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

try {
    $input = json_decode(file_get_contents('php://input'), true);
    error_log(print_r($input, true));
    $ids = [];

    // Normalize IDs
    if (isset($input['room_id'])) {
        $ids[] = (int)$input['room_id'];
    } elseif (!empty($input['ids']) && is_array($input['ids'])) {
        $ids = array_map('intval', $input['ids']);
    }

    if (empty($ids)) {
        respond_json(400, ['success' => false, 'message' => 'No room IDs provided']);
    }

    $pdo = get_pdo();
    $pdo->beginTransaction();

    $deletedCount = 0;
    $skippedActive = [];

    $selectRoom = $pdo->prepare("SELECT * FROM rooms WHERE room_id = ? FOR UPDATE");
    $checkActive = $pdo->prepare("
        SELECT COUNT(*) FROM booking_rooms br
        JOIN bookings b ON b.booking_id = br.booking_id
        WHERE br.room_id = ? AND b.status IN ('Confirmed', 'Checked-in')
    ");
    $deleteAssign = $pdo->prepare("DELETE FROM booking_rooms WHERE room_id = ?");
    $deleteRoom = $pdo->prepare("DELETE FROM rooms WHERE room_id = ?");

    foreach ($ids as $roomId) {
        $selectRoom->execute([$roomId]);
        $room = $selectRoom->fetch();

        if (!$room) continue;

        $checkActive->execute([$roomId]);
        if ((int)$checkActive->fetchColumn() > 0) {
            $skippedActive[] = $room['room_number'] ?? $roomId;
            continue;
        }

        $deleteAssign->execute([$roomId]);
        $deleteRoom->execute([$roomId]);
        $deletedCount++;
    }

    $pdo->commit();
    $pdo = null; // Force close connection early

    $message = "$deletedCount room(s) deleted successfully.";
    if (!empty($skippedActive)) {
        $message .= " Skipped rooms with active bookings: " . implode(', ', $skippedActive);
    }

    // Flush and terminate instantly
    respond_json(200, [
        'success' => true,
        'message' => $message,
        'deleted' => $deletedCount,
        'skipped' => $skippedActive
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to delete rooms',
        'error' => $e->getMessage()
    ]);
} finally {
    // Explicitly close DB and flush output to prevent hanging
    if (isset($pdo)) $pdo = null;
    if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
}

exit;