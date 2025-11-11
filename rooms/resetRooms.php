<?php
header("Content-Type: application/json");
require_once __DIR__ . '/../../db.php';

try {
    $pdo = get_pdo();

    // Disable foreign key checks to safely truncate dependent tables
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");

    // Truncate tables in proper dependency order
    $pdo->exec("TRUNCATE TABLE booking_items");  // booking_items before bookings
    $pdo->exec("TRUNCATE TABLE bookings");
    $pdo->exec("TRUNCATE TABLE rooms");
    $pdo->exec("TRUNCATE TABLE room_types");
    // Users are kept intact, assuming you don't want to delete them

    // Re-enable constraints
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    echo json_encode([
        "success" => true,
        "message" => "Bookings, booking_items, rooms, and room_types reset successfully!"
    ]);
} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}
