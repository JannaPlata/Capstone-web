<?php
declare(strict_types=1);

require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';

try {
    $pdo = get_pdo();

    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1; // Default to page 1 if not set
    $itemsPerPage = isset($_GET['itemsPerPage']) ? (int)$_GET['itemsPerPage'] : 5; // Default to 5 items per page
    $offset = ($page - 1) * $itemsPerPage;
    
    // Build WHERE clause based on filters
    $where = [];
    $params = [];
    
    // Search filter: separate room_number and type_name search terms
    if (isset($_GET['search']) && !empty($_GET['search'])) {
        $search = sanitize_string($_GET['search']);
        $where[] = "(r.room_number LIKE :search_number OR rt.type_name LIKE :search_type)";
        $params[':search_number'] = "%{$search}%";
        $params[':search_type'] = "%{$search}%";
    }
    
    // Room type filter
    if (isset($_GET['room_type']) && $_GET['room_type'] !== 'all') {
        $roomType = sanitize_string($_GET['room_type']);
        $where[] = "rt.type_name = :room_type";
        $params[':room_type'] = $roomType;
    }
    
    // Status filter
    if (isset($_GET['status']) && $_GET['status'] !== 'all') {
        $status = sanitize_string($_GET['status']);
        $where[] = "r.status = :status";
        $params[':status'] = $status;
    }


    
    // Combine WHERE conditions
    $whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    
    // Construct SQL query
    $sql = "SELECT 
                r.room_id,
                r.room_number,
                r.status,
                rt.room_type_id,
                rt.type_name,
                rt.capacity_adults,
                rt.capacity_children,
                rt.price_per_night
            FROM rooms r
            JOIN room_types rt ON rt.room_type_id = r.room_type_id
            {$whereClause}
            ORDER BY r.room_number";
            
    
    // Prepare and execute the query
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Respond with data
    respond_json(200, [
        'success' => true,
        'count' => count($rooms),   
        'data' => $rooms,
        'message' => $rooms ? '' : 'No rooms found'
    ]);
    
} catch (Throwable $e) {
    // Handle errors
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to fetch rooms',
        'error' => $e->getMessage()
    ]);
}