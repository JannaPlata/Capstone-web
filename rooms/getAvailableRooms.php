<?php
require_once __DIR__ . '/../../db.php';

try {
    $pdo = get_pdo();
    $room_type_id = $_GET['room_type_id'] ?? null;
    $check_in = $_GET['check_in'] ?? null; // unused, left for extension
    $check_out = $_GET['check_out'] ?? null;
    $booking_id = $_GET['booking_id'] ?? null;
    
    // Pagination parameters
    $page = max(1, (int)($_GET['page'] ?? 1));
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 10))); // Default 10, max 50
    $offset = ($page - 1) * $limit;
    
    $filters = ' WHERE r.status = "Available"';
    $params = [];

    if ($room_type_id) {
        $filters .= ' AND r.room_type_id = :room_type_id';
        $params[':room_type_id'] = $room_type_id;
    }

    // Special: filter for only types A booking still needs assigned
    $restrictTypes = null;
    if ($booking_id) {
        // Build hash of needed room_type_id => needed-qty
        $q = $pdo->prepare('SELECT room_type_id, quantity FROM booking_items WHERE booking_id = ?');
        $q->execute([$booking_id]);
        $byType = [];
        foreach ($q->fetchAll() as $row) {
            $byType[(int)$row['room_type_id']] = (int)$row['quantity'];
        }
        // Subtract already assigned per type
        $q2 = $pdo->prepare('SELECT r.room_type_id FROM booking_rooms br JOIN rooms r ON br.room_id = r.room_id WHERE br.booking_id = ?');
        $q2->execute([$booking_id]);
        foreach ($q2->fetchAll() as $row) {
            $tid = (int)$row['room_type_id'];
            if (isset($byType[$tid])) {
                $byType[$tid]--;
                if ($byType[$tid] <= 0) unset($byType[$tid]);
            }
        }
        // Only show available rooms in these types
        $restrictTypes = array_keys($byType);
        if ($restrictTypes) {
            $in = implode(',', array_fill(0, count($restrictTypes), '?'));
            $filters .= " AND r.room_type_id IN ($in)";
            $params = array_merge($params, $restrictTypes);
        } else {
            // No rooms left to assign
            respond_json(200, ['success'=>true,'data'=>[]]);
        }
    }

    // First, get total count for pagination
    $countSql = "SELECT COUNT(*) as total FROM rooms r JOIN room_types rt ON r.room_type_id = rt.room_type_id" . $filters;
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute(array_values($params));
    $totalCount = $countStmt->fetch()['total'];
    
    // Then get paginated results
    $sql = "SELECT r.room_id, r.room_number, r.status, rt.room_type_id, rt.type_name, rt.price_per_night, rt.capacity_adults, rt.capacity_children
            FROM rooms r
            JOIN room_types rt ON r.room_type_id = rt.room_type_id" . $filters . " 
            ORDER BY r.room_number 
            LIMIT ? OFFSET ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(array_merge(array_values($params), [$limit, $offset]));
    $rooms = $stmt->fetchAll();
    
    $totalPages = ceil($totalCount / $limit);
    
    respond_json(200, [
        'success' => true, 
        'data' => $rooms,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_count' => $totalCount,
            'limit' => $limit,
            'has_next' => $page < $totalPages,
            'has_prev' => $page > 1
        ]
    ]);

} catch (Throwable $e) {
    respond_json(500, [
        'success'=>false,
        'message'=>'Failed to fetch available rooms',
        'error'=>$e->getMessage()
    ]);
}