<?php
require_once __DIR__ . '/../../db.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$raw = trim(file_get_contents("php://input"));
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid or empty JSON",
    ]);
    exit;
}

$booking_id = $data['booking_id'] ?? null;
$action = strtolower(trim($data['action'] ?? ''));
$datetime = $data['datetime'] ?? null; // Optional datetime for check-in/check-out

if (!$booking_id || !$action) {
    echo json_encode(["success" => false, "message" => "Missing booking_id or action"]);
    exit;
}

try {
    $pdo = get_pdo();
    $allowedPaymentStatuses = [];
    
    // Try to ensure payment_status enum includes the desired values before we start the transaction.
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings WHERE Field = 'payment_status'");
        $columnInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($columnInfo && isset($columnInfo['Type'])) {
            if (preg_match_all("/'([^']+)'/", $columnInfo['Type'], $matches)) {
                $allowedPaymentStatuses = $matches[1];
            }
            if (!in_array('Partial Payment', $allowedPaymentStatuses, true) || !in_array('Payment Complete', $allowedPaymentStatuses, true)) {
                // Attempt to update the ENUM to the desired set. This will auto-commit.
                try {
                    $pdo->exec("ALTER TABLE bookings MODIFY COLUMN payment_status ENUM('Pending', 'Partial Payment', 'Payment Complete') DEFAULT 'Pending'");
                    $allowedPaymentStatuses = ['Pending', 'Partial Payment', 'Payment Complete'];
                } catch (Exception $e) {
                    // If the ALTER TABLE fails (permissions, etc.), log it and continue with whatever enum we currently have.
                    error_log("Failed to update payment_status enum: " . $e->getMessage());
                }
            }
        }
    } catch (Exception $e) {
        // If we can't inspect the enum, log the error and continue; we'll fallback later if needed.
        error_log("Failed to check payment_status enum: " . $e->getMessage());
    }
    
    if (empty($allowedPaymentStatuses)) {
        // Default assumption if we couldn't detect anything.
        $allowedPaymentStatuses = ['Pending', 'Partial Payment', 'Payment Complete'];
    }
    
    $pdo->beginTransaction();
    
    // Get current booking details including guest info and room
    $stmt = $pdo->prepare("
        SELECT 
            b.status, 
            b.payment_status,
            b.check_in,
            b.check_out,
            u.full_name AS guest_name,
            u.email,
            r.room_number,
            rt.type_name AS room_type
        FROM bookings b
        JOIN users u ON b.user_id = u.user_id
        LEFT JOIN booking_rooms br ON br.booking_id = b.booking_id
        LEFT JOIN rooms r ON r.room_id = br.room_id
        LEFT JOIN room_types rt ON rt.room_type_id = b.room_type_id
        WHERE b.booking_id = ?
        LIMIT 1
    ");
    $stmt->execute([$booking_id]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$current) {
        $pdo->rollBack();
        echo json_encode(["success" => false, "message" => "Booking not found"]);
        exit;
    }
    
    $currentStatus = $current['status'];
    $currentPaymentStatus = $current['payment_status'];
    $guestName = $current['guest_name'] ?? 'Guest';
    // Normalize guest name: remove newlines and collapse multiple spaces so it displays on one line
    $guestName = preg_replace('/\s+/', ' ', trim($guestName));
    $email = $current['email'] ?? '';
    $roomNumber = $current['room_number'] ?? '';
    $roomType = $current['room_type'] ?? '';
    // Format room: if room number exists, use it; otherwise use room type
    $room = $roomNumber ? "Room $roomNumber" : ($roomType ? $roomType : '—');
    $checkOutDate = null; // Will be set if check-out date changes
    
    // For check-out: extract date from datetime to update check_out if different
    if ($action === 'checkout' && $datetime) {
        $checkOutDate = date('Y-m-d', strtotime($datetime));
    }
    
    // Define status and payment transitions based on action and current state
    // Flow:
    // 1. Booking Created: payment_status = Pending, status = Confirmed
    // 2. Mark as Paid: payment_status = Partial Payment, status = Confirmed
    // 3. Check-in: payment_status = Partial Payment (unchanged), status = Checked-in
    // 4. Check-out: payment_status = Payment Complete, status = Checked-out
    $newStatus = $currentStatus;
    $newPaymentStatus = $currentPaymentStatus;
    
    if ($action === 'paid') {
        $newStatus = 'Confirmed';
        $newPaymentStatus = 'Partial Payment';
    } elseif ($action === 'checkin') {
        $newStatus = 'Checked-in';
        $newPaymentStatus = 'Partial Payment'; // Keep as Partial Payment (unchanged)
    } elseif ($action === 'checkout') {
        $newStatus = 'Checked-out';
        $newPaymentStatus = 'Payment Complete';
    } elseif ($action === 'cancel') {
        $newStatus = 'Cancelled';
        // Keep current payment status when cancelling
        $newPaymentStatus = $currentPaymentStatus;
    } else {
        echo json_encode(["success" => false, "message" => "Invalid action"]);
        exit;
    }

    // Determine the value that can actually be stored in the bookings table, based on the ENUM definition.
    $storagePaymentStatus = $newPaymentStatus;
    if (!empty($allowedPaymentStatuses) && !in_array($newPaymentStatus, $allowedPaymentStatuses, true)) {
        if ($newPaymentStatus === 'Partial Payment' && in_array('Paid', $allowedPaymentStatuses, true)) {
            $storagePaymentStatus = 'Paid';
        } elseif ($newPaymentStatus === 'Payment Complete' && in_array('Completed', $allowedPaymentStatuses, true)) {
            $storagePaymentStatus = 'Completed';
        } elseif (in_array('Pending', $allowedPaymentStatuses, true)) {
            $storagePaymentStatus = 'Pending';
        } else {
            // Fallback to the first allowed value to avoid storing an empty string.
            $storagePaymentStatus = $allowedPaymentStatuses[0];
        }
    }
    
    // Check if check_in_time and check_out_time columns exist
    $hasCheckInTime = false;
    $hasCheckOutTime = false;
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'check_in_time'");
        $hasCheckInTime = $stmt->rowCount() > 0;
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'check_out_time'");
        $hasCheckOutTime = $stmt->rowCount() > 0;
    } catch (Exception $e) {
        // Columns don't exist, continue without them
    }
    
    // Map action to last_action value for booking_logs
    $lastActionMap = [
        'paid' => 'Paid',
        'checkin' => 'Check-in',
        'checkout' => 'Check-out',
        'cancel' => 'Cancel'
    ];
    $lastAction = $lastActionMap[$action] ?? 'Unknown';
    
    // Build the update query based on action
    if ($action === 'checkin' && $datetime) {
        // Update status, payment_status, and optionally check_in_time
        if ($hasCheckInTime) {
            $stmt = $pdo->prepare("
                UPDATE bookings 
                SET status = ?, payment_status = ?, check_in_time = ? 
                WHERE booking_id = ?
            ");
            $stmt->execute([$newStatus, $storagePaymentStatus, $datetime, $booking_id]);
        } else {
            $stmt = $pdo->prepare("
                UPDATE bookings 
                SET status = ?, payment_status = ? 
                WHERE booking_id = ?
            ");
            $stmt->execute([$newStatus, $storagePaymentStatus, $booking_id]);
        }
    } elseif ($action === 'checkout' && $datetime) {
        // Update status, payment_status, check_out_time, and check_out date if changed
        if ($hasCheckOutTime) {
            // Update check_out date if it's different from the datetime date
            $stmt = $pdo->prepare("
                UPDATE bookings 
                SET status = ?, payment_status = ?, check_out_time = ?, check_out = ? 
                WHERE booking_id = ?
            ");
            $stmt->execute([$newStatus, $storagePaymentStatus, $datetime, $checkOutDate, $booking_id]);
        } else {
            // If check_out_time column doesn't exist, still update check_out date
            $stmt = $pdo->prepare("
                UPDATE bookings 
                SET status = ?, payment_status = ?, check_out = ? 
                WHERE booking_id = ?
            ");
            $stmt->execute([$newStatus, $storagePaymentStatus, $checkOutDate, $booking_id]);
        }
    } else {
        // For paid, cancel, or if no datetime provided, just update status and payment_status
        $stmt = $pdo->prepare("
            UPDATE bookings 
            SET status = ?, payment_status = ? 
            WHERE booking_id = ?
        ");
        $result = $stmt->execute([$newStatus, $storagePaymentStatus, $booking_id]);
        if (!$result) {
            $pdo->rollBack();
            $errorInfo = $stmt->errorInfo();
            echo json_encode([
                "success" => false,
                "message" => "Update failed",
                "error" => $errorInfo[2] ?? "Unknown database error"
            ]);
            exit;
        }
    }
    
    // Get actual check-in/check-out timestamps from bookings table (after update)
    // We will fallback to the original booking dates if the *_time fields are not present
    $logCheckIn = null;
    $logCheckOut = null;
    try {
        $stmt = $pdo->prepare("SELECT check_in_time, check_out_time FROM bookings WHERE booking_id = ?");
        $stmt->execute([$booking_id]);
        $timeData = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($timeData) {
            $logCheckIn = $timeData['check_in_time'] ?? null;
            $logCheckOut = $timeData['check_out_time'] ?? null;
        }
    } catch (Exception $e) {
        
    }

    
    if (is_null($logCheckIn)) {
        $logCheckIn = $current['check_in'] ?? date('Y-m-d');
    }
    if (is_null($logCheckOut)) {
        $logCheckOut = $current['check_out'] ?? date('Y-m-d');
    }
    
    // Check if booking_logs table has the new schema columns
    $hasNewSchema = false;
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM booking_logs LIKE 'guest_name'");
        $hasNewSchema = $stmt->rowCount() > 0;
    } catch (Exception $e) {
        // Table might not have new columns yet
    }
    
    if ($hasNewSchema) {
        // Check if email and room_number columns exist in booking_logs
        $hasEmail = false;
        $hasRoomNumber = false;
        try {
            $stmt = $pdo->query("SHOW COLUMNS FROM booking_logs LIKE 'email'");
            $hasEmail = $stmt->rowCount() > 0;
            $stmt = $pdo->query("SHOW COLUMNS FROM booking_logs LIKE 'room_number'");
            $hasRoomNumber = $stmt->rowCount() > 0;
        } catch (Exception $e) {
            // Column doesn't exist
        }

        // Build the INSERT query dynamically based on available columns
        $columns = ['booking_id', 'guest_name'];
        $values = [$booking_id, $guestName];
        $placeholders = ['?', '?'];

        if ($hasEmail) {
            $columns[] = 'email';
            $values[] = $email;
            $placeholders[] = '?';
        }

        if ($hasRoomNumber) {
            $columns[] = 'room_number';
            // store raw room number (or empty string) so logs can be queried by number
            $values[] = $roomNumber ?? '';
            $placeholders[] = '?';
        }

    // Use the storage-safe payment status (mapped to the booking table ENUM) when writing logs
    $columns = array_merge($columns, ['payment_status', 'status', 'room', 'check_in', 'check_out', 'last_action', 'action_timestamp', 'performed_by']);
    $values = array_merge($values, [$storagePaymentStatus, $newStatus, $room, $logCheckIn, $logCheckOut, $lastAction]);
        // Keep action_timestamp as NOW() literal in the placeholders list (no matching value)
        $placeholders = array_merge($placeholders, ['?', '?', '?', '?', '?', '?', 'NOW()', '?']);
        $values[] = 'Admin';

        $sql = "INSERT INTO booking_logs (" . implode(', ', $columns) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);
    } else {
        // Old schema: Just insert basic log
        $stmt = $pdo->prepare("
            INSERT INTO booking_logs (booking_id, action, timestamp)
            VALUES (?, ?, NOW())
        ");
        $stmt->execute([$booking_id, $lastAction]);
    }
    
    $pdo->commit();

    // Return success response with updated status and payment status
    echo json_encode([
        "success" => true,
        "message" => "Booking status updated successfully.",
        "status" => $newStatus,
        "payment_status" => $newPaymentStatus
    ]);

} catch (Throwable $e) {
    // Handle error
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode([
        "success" => false,
        "message" => "Update failed",
        "error" => $e->getMessage()
    ]);
}
