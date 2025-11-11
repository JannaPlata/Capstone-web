<?php
declare(strict_types=1);
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';

try {
    $pdo = get_pdo();
    
    // Build WHERE clause based on filters (same as getBookingLogs.php)
    $where = [];
    $params = [];
    
    if (isset($_GET['search']) && !empty($_GET['search'])) {
        $search = sanitize_string($_GET['search']);
        $where[] = "(CAST(bl.log_id AS CHAR) LIKE :search OR bl.booking_id LIKE :search OR bl.guest_name LIKE :search OR bl.room LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    if (isset($_GET['status']) && $_GET['status'] !== 'All') {
        $status = sanitize_string($_GET['status']);
        $where[] = "bl.status = :status";
        $params[':status'] = $status;
    }
    
    if (isset($_GET['room_type']) && $_GET['room_type'] !== 'All') {
        $roomType = sanitize_string($_GET['room_type']);
        $where[] = "bl.room LIKE :room_type";
        $params[':room_type'] = "%{$roomType}%";
    }
    
    if (isset($_GET['date_from']) && !empty($_GET['date_from'])) {
        $where[] = "DATE(bl.check_in) >= :date_from";
        $params[':date_from'] = $_GET['date_from'];
    }
    
    if (isset($_GET['date_to']) && !empty($_GET['date_to'])) {
        $where[] = "DATE(bl.check_in) <= :date_to";
        $params[':date_to'] = $_GET['date_to'];
    }
    
    if (isset($_GET['payment_status']) && $_GET['payment_status'] !== 'All') {
        $paymentStatus = sanitize_string($_GET['payment_status']);
        $where[] = "bl.payment_status = :payment_status";
        $params[':payment_status'] = $paymentStatus;
    }
    
    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    
    $sql = "SELECT 
        bl.log_id,
        bl.booking_id,
        bl.guest_name,
        bl.payment_status,
        bl.status,
        bl.room,
        bl.check_in,
        bl.check_out,
        bl.last_action,
        bl.action_timestamp,
        bl.performed_by
    FROM booking_logs bl
    {$whereClause}
    ORDER BY bl.action_timestamp DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();
    
    // Set headers for CSV download
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="booking_logs_' . date('Y-m-d_H-i-s') . '.csv"');
    
    // Create CSV output
    $output = fopen('php://output', 'w');
    
    // CSV headers
    $headers = [
        'Log ID',
        'Booking ID',
        'Guest Name',
        'Payment Status',
        'Status',
        'Room',
        'Check-In',
        'Check-Out',
        'Last Action',
        'Timestamp',
        'Performed By'
    ];
    fputcsv($output, $headers);
    
    // CSV data
    foreach ($logs as $log) {
        $row = [
            $log['log_id'],
            $log['booking_id'],
            $log['guest_name'],
            $log['payment_status'],
            $log['status'],
            $log['room'],
            $log['check_in'],
            $log['check_out'],
            $log['last_action'],
            $log['action_timestamp'],
            $log['performed_by']
        ];
        fputcsv($output, $row);
    }
    
    fclose($output);
    exit;
    
} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to export booking logs',
        'error' => $e->getMessage()
    ]);
}

?>
