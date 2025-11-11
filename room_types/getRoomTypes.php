<?php
declare(strict_types=1);
require __DIR__ . '/../db.php';
require __DIR__ . '/../helper.php';


try {
    $pdo = get_pdo();
    
    $sql = "SELECT 
        room_type_id,
        type_name,
        capacity_adults,
        capacity_children,
        price_per_night
    FROM room_types
    ORDER BY type_name";
    
    $stmt = $pdo->query($sql);
    $roomTypes = $stmt->fetchAll();
    
    respond_json(200, [
        'success' => true,
        'data' => $roomTypes
    ]);
    
} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to fetch room types',
        'error' => $e->getMessage()
    ]);
}

?>
