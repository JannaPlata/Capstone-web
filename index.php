<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/email.php';




$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';

function route_starts_with(string $path, string $prefix): bool { 
    return strpos($path, $prefix) === 0; 
}

function id_from_path(string $path): ?int { 
    $parts = explode('/', trim($path, '/')); 
    $id = end($parts); 
    return ctype_digit((string)$id) ? (int)$id : null; 
}

try {
    $pdo = get_pdo();
    
    // DASHBOARD ENDPOINTS
    if ($method === 'GET' && $path === '/api/dashboard/stats') {
        include __DIR__ . '/dashboard/getDashboardStats.php';
    }
    if ($method === 'GET' && $path === '/api/dashboard/recent-bookings') {
        include __DIR__ . '/dashboard/getRecentBookings.php';
    }
    
    // BOOKINGS ENDPOINTS
    if ($method === 'GET' && $path === '/api/bookings') {
        include __DIR__ . '/bookings/getBookings.php';
    }
    if ($method === 'POST' && $path === '/api/bookings/confirm') {
        include __DIR__ . '/bookings/confirmBooking.php';
    }
    if ($method === 'POST' && $path === '/api/bookings/cancel') {
        include __DIR__ . '/bookings/cancelBooking.php';
    }
    if ($method === 'POST' && $path === '/api/bookings/checkin') {
        include __DIR__ . '/bookings/checkinBooking.php';
    }
    if ($method === 'POST' && $path === '/api/bookings/checkout') {
        include __DIR__ . '/bookings/checkoutBooking.php';
    }
    
    // BOOKING LOGS ENDPOINTS
    if ($method === 'GET' && $path === '/api/booking_logs') {
        include __DIR__ . '/logs/getBookingLogs.php';
    }
    if ($method === 'GET' && $path === '/api/booking_logs/export') {
        include __DIR__ . '/logs/exportBookingLogs.php';
    }
    
   // ROOMS ENDPOINTS

// Get all rooms
if ($method === 'GET' && $path === '/api/rooms') {
    include __DIR__ . '/rooms/getRooms.php';
}

// Get a specific room by ID
if ($method === 'GET' && route_starts_with($path, '/api/rooms/')) {
    include __DIR__ . '/rooms/getRoomById.php';
}

// Add a new room
if ($method === 'POST' && $path === '/api/rooms') {
    include __DIR__ . '/rooms/addRoom.php';
}

// Update a specific room by ID
if ($method === 'PUT' && route_starts_with($path, '/api/rooms/')) {
    include __DIR__ . '/rooms/updateRoom.php';
}

// Delete a specific room by ID
if ($method === 'DELETE' && route_starts_with($path, '/api/rooms/')) {
    include __DIR__ . '/rooms/deleteRoom.php';
}

// Get guests of a specific room by ID
if ($method === 'GET' && route_starts_with($path, '/api/rooms/guests/')) {
    include __DIR__ . '/rooms/getRoomGuests.php';
}



    
    // GUESTS ENDPOINTS
    if ($method === 'GET' && $path === '/api/guests') {
        include __DIR__ . '/guests/getGuests.php';
    }
    
    // EMAIL ENDPOINT
    if ($method === 'POST' && $path === '/api/send-email') {
        $input = required(json_input(), ['toEmail', 'toName', 'subject', 'htmlBody']);
        $result = send_email($input['toEmail'], $input['toName'], $input['subject'], $input['htmlBody'], $input['altBody'] ?? '');
        respond_json($result['success'] ? 200 : 500, $result);
    }
    
    // LEGACY ENDPOINTS (for backward compatibility)
    if ($method === 'GET' && $path === '/api/bookings') {
        include __DIR__ . '/bookings/getBookings.php';
    }
    if ($method === 'GET' && $path === '/api/guests') {
        include __DIR__ . '/guests/getGuests.php';
    }
    if ($method === 'GET' && $path === '/api/rooms') {
        include __DIR__ . '/rooms/getRooms.php';
    }
    if ($method === 'GET' && $path === '/api/booking_logs') {
        include __DIR__ . '/logs/getBookingLogs.php';
    }
    
    respond_json(404, ['success' => false, 'message' => 'Endpoint not found']);
    
} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Server error',
        'error' => $e->getMessage()
    ]);
}

?>