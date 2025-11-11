<?php
declare(strict_types=1);

// CORS + JSON headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';

// ROUTER
switch ($path) {

    // ---- ROOMS ----
    case '/api/rooms/list':
        require __DIR__ . '/api/rooms/getRooms.php';
        break;
    case '/api/rooms/add':
        require __DIR__ . '/api/rooms/addRoom.php';
        break;
    case '/api/rooms/update':
        require __DIR__ . '/api/rooms/updateRoom.php';
        break;
    case '/api/rooms/delete':
        require __DIR__ . '/api/rooms/deleteRoom.php';
        break;
    case '/api/rooms/guests':
        require __DIR__ . '/api/rooms/getRoomGuests.php';
        break;

    // ---- BOOKINGS ----
    case '/api/bookings/list':
        require __DIR__ . '/api/bookings/getBookings.php';
        break;
    case '/api/bookings/checkin':
        require __DIR__ . '/api/bookings/checkinBooking.php';
        break;
    case '/api/bookings/checkout':
        require __DIR__ . '/api/bookings/checkoutBooking.php';
        break;
    case '/api/bookings/confirm':
        require __DIR__ . '/api/bookings/confirmBooking.php';
        break;
    case '/api/bookings/cancel':
        require __DIR__ . '/api/bookings/cancelBooking.php';
        break;

    // ---- DASHBOARD ----
    case '/api/dashboard/stats':
        require __DIR__ . '/api/dashboard/getDashboardStats.php';
        break;
    case '/api/dashboard/recent':
        require __DIR__ . '/api/dashboard/getRecentBookings.php';
        break;

    // ---- GUESTS ----
    case '/api/guests/list':
        require __DIR__ . '/api/guests/getGuests.php';
        break;

    // ---- LOGS ----
    case '/api/logs/booking/export':
        require __DIR__ . '/api/logs/exportBookingLogs.php';
        break;
    case '/api/logs/booking/list':
        require __DIR__ . '/api/logs/getBookingLogs.php';
        break;

    // ---- ROOM TYPES ----
    case '/api/room_types/list':
        require __DIR__ . '/api/room_types/getRoomTypes.php';
        break;
    case '/api/room_types/add':
        require __DIR__ . '/api/room_types/addRoomType.php';
        break;

    // ---- DEFAULT ----
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found: ' . $path]);
        break;
}
