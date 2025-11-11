<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
    header('Vary: Origin');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    echo json_encode(['success' => true]);
    exit;
}

// Database configuration for AlwaysData
$DB_HOST = 'mysql-rosarioresortshotel.alwaysdata.net';
$DB_NAME = 'rosarioresortshotel_db';
$DB_USER = '423538';   
$DB_PASS = 'rosarioresorts';
$DB_CHARSET = 'utf8mb4';

function respond_json(int $statusCode, $payload): void {
    http_response_code($statusCode);
    echo is_string($payload) ? $payload : json_encode($payload);
    exit;
}

function get_pdo(): PDO {
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS, $DB_CHARSET;
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset={$DB_CHARSET}";
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    try {
        $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
        return $pdo;
    } catch (Throwable $e) {
        respond_json(500, [
            'success' => false,
            'message' => 'Database connection failed',
            'error' => $e->getMessage()
        ]);
        throw $e; // Unreachable, but satisfies static analysis.
    }
}
// Add missing columns to existing bookings table
function migrate_bookings_table() {
    try {
        $pdo = get_pdo();
        
        // Check if adults column exists
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'adults'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE bookings ADD COLUMN adults INT DEFAULT 1");
        }
        
        // Check if children column exists
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'children'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE bookings ADD COLUMN children INT DEFAULT 0");
        }
        
        // Check if notes column exists
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'notes'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE bookings ADD COLUMN notes TEXT NULL");
        }
        
        // Check if payment_status column exists
        $stmt = $pdo->query("SHOW COLUMNS FROM bookings LIKE 'payment_status'");
        if ($stmt->rowCount() == 0) {
            $pdo->exec("ALTER TABLE bookings ADD COLUMN payment_status ENUM('Pending', 'Partial Payment', 'Payment Complete') DEFAULT 'Pending'");
        } else {
            // Check current ENUM values and update if needed
            $stmt = $pdo->query("SHOW COLUMNS FROM bookings WHERE Field = 'payment_status'");
            $column = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($column && isset($column['Type'])) {
                $currentType = $column['Type'];
                $hasPending = strpos($currentType, 'Pending') !== false;
                $hasPartial = strpos($currentType, 'Partial Payment') !== false;
                $hasComplete = strpos($currentType, 'Payment Complete') !== false;
                
                if (!($hasPending && $hasPartial && $hasComplete)) {
                    try {
                        $pdo->exec("ALTER TABLE bookings MODIFY COLUMN payment_status ENUM('Pending', 'Partial Payment', 'Payment Complete') DEFAULT 'Pending'");
                    } catch (Exception $e) {
                        error_log("Error updating payment_status ENUM: " . $e->getMessage());
                    }
                }
            }
        }
        
    } catch (Exception $e) {
        error_log("Migration error: " . $e->getMessage());
    }
}

// Run migration
migrate_bookings_table();

?>