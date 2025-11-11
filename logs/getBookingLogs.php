<?php
declare(strict_types=1);
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';


try {
    $pdo = get_pdo();
    
    // Build WHERE clause based on filters
    $where = [];
    $params = [];
    
    // Search filter
    if (isset($_GET['search']) && !empty($_GET['search'])) {
        $search = sanitize_string($_GET['search']);
        // Include booking id, guest name, room text and room_number in search
        $where[] = "(bl.booking_id LIKE :search OR bl.guest_name LIKE :search OR bl.room LIKE :search OR bl.room_number LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    // Status filter
    if (isset($_GET['status']) && $_GET['status'] !== 'All') {
        $status = sanitize_string($_GET['status']);
        $where[] = "bl.status = :status";
        $params[':status'] = $status;
    }
    
    // Room type filter
    if (isset($_GET['room_type']) && $_GET['room_type'] !== 'All') {
        $roomType = sanitize_string($_GET['room_type']);
        // Match against the joined room_types type_name or fallback to room text
        $where[] = "(rt.type_name = :room_type OR bl.room LIKE :room_type_like)";
        $params[':room_type'] = $roomType;
        $params[':room_type_like'] = "%{$roomType}%";
    }
    
    // Date range filter
    if (isset($_GET['date_from']) && !empty($_GET['date_from'])) {
        $where[] = "DATE(bl.check_in) >= :date_from";
        $params[':date_from'] = $_GET['date_from'];
    }
    
    if (isset($_GET['date_to']) && !empty($_GET['date_to'])) {
        $where[] = "DATE(bl.check_in) <= :date_to";
        $params[':date_to'] = $_GET['date_to'];
    }
    
    // Payment status filter
    if (isset($_GET['payment_status']) && $_GET['payment_status'] !== 'All') {
        $paymentStatus = sanitize_string($_GET['payment_status']);
        $where[] = "bl.payment_status = :payment_status";
        $params[':payment_status'] = $paymentStatus;
    }
    
    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    
    // Check if booking_logs has email column, if not get from bookings join
    $hasEmail = false;
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM booking_logs LIKE 'email'");
        $hasEmail = $stmt->rowCount() > 0;
    } catch (Exception $e) {
        // Column doesn't exist
    }
    
    // We'll always join bookings and room_types (when available) so we can return room_number and room_type
    // Check if room_types table exists and join accordingly
    $sql = "SELECT 
            bl.log_id,
            bl.booking_id,
            bl.guest_name,
            " . ($hasEmail ? "bl.email" : "COALESCE(u.email, '') AS email") . ",
            bl.payment_status,
            bl.status,
            bl.room,
            bl.room_number,
            b.room_type_id,
            rt.type_name AS room_type,
            bl.check_in,
            bl.check_out,
            bl.last_action,
            bl.action_timestamp,
            bl.performed_by
        FROM booking_logs bl
        LEFT JOIN bookings b ON b.booking_id = bl.booking_id
        LEFT JOIN room_types rt ON rt.room_type_id = b.room_type_id
        " . ($hasEmail ? "" : "LEFT JOIN users u ON u.user_id = b.user_id") . "
        {$whereClause}
        ORDER BY bl.action_timestamp DESC
        LIMIT 500";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();
    
    respond_json(200, [
        'success' => true,
        'data' => $logs
    ]);
    
} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to fetch booking logs',
        'error' => $e->getMessage()
    ]);
}

?>
