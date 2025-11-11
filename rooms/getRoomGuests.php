<?php
declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';

try {
    $pdo = get_pdo();

    // Prefer query param ?room_id=, fallback to trailing path segment
    $roomId = isset($_GET['room_id']) ? (int)$_GET['room_id'] : (int) basename(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

    if ($roomId <= 0) {
        respond_json(400, ['success' => false, 'message' => 'room_id is required']);
    }

    $sql = "SELECT 
        b.booking_id,
        u.user_id AS guest_id,
        u.full_name AS guest_name,
        u.email,
        u.phone,
        b.check_in,
        b.check_out,
        b.status,
        rt.type_name AS room_type,
        rt.capacity_adults,
        rt.capacity_children,
        rt.price_per_night,
        b.total_price,
        b.adults,
        b.children,
        b.notes,
        b.payment_status
    FROM bookings b
    JOIN users u ON u.user_id = b.user_id
    JOIN room_types rt ON rt.room_type_id = b.room_type_id
    JOIN booking_rooms br ON br.booking_id = b.booking_id
    WHERE br.room_id = :room_id 
      AND b.status IN ('Confirmed', 'Checked-in', 'Pending', 'Checked-out')
    ORDER BY b.check_in DESC
    LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':room_id' => $roomId]);
    $data = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$data) {
        respond_json(200, ['success' => true, 'data' => null]);
    }

    respond_json(200, ['success' => true, 'data' => $data]);

} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to fetch room guest',
        'error' => $e->getMessage()
    ]);
}