<?php
declare(strict_types=1);
require __DIR__ . '/../db.php';
require __DIR__ . '/../helper.php';


try {
    $pdo = get_pdo();
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
    
    $sql = "SELECT 
        b.booking_id,
        b.user_id,
        u.full_name,
        u.email,
        u.phone,
        rt.type_name,
        b.check_in_date,
        b.check_out_date,
        b.total_price,
        b.status,
        b.created_at,
        br.room_id,
        r.room_number
    FROM bookings b
    JOIN users u ON u.user_id = b.user_id
    JOIN room_types rt ON rt.room_type_id = b.room_type_id
    LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
    LEFT JOIN rooms r ON r.room_id = br.room_id
    ORDER BY b.created_at DESC
    LIMIT :limit";
    
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $bookings = $stmt->fetchAll();
    
    respond_json(200, [
        'success' => true,
        'data' => $bookings
    ]);
    
} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to fetch recent bookings',
        'error' => $e->getMessage()
    ]);
}

?>
