<?php
declare(strict_types=1);
require __DIR__ . '/../db.php';
require __DIR__ . '/../helper.php';


try {
    $pdo = get_pdo();
    $input = json_input();
    $input = required($input, ['type_name', 'capacity_adults', 'capacity_children', 'price_per_night']);
    
    $typeName = sanitize_string($input['type_name']);
    $capacityAdults = (int)$input['capacity_adults'];
    $capacityChildren = (int)$input['capacity_children'];
    $pricePerNight = (float)$input['price_per_night'];
    
    // Validate inputs
    if ($capacityAdults < 1) {
        respond_json(400, ['success' => false, 'message' => 'Capacity adults must be at least 1']);
    }
    
    if ($capacityChildren < 0) {
        respond_json(400, ['success' => false, 'message' => 'Capacity children cannot be negative']);
    }
    
    if ($pricePerNight < 0) {
        respond_json(400, ['success' => false, 'message' => 'Price per night cannot be negative']);
    }
    
    // Check if room type name already exists
    $stmt = $pdo->prepare("SELECT room_type_id FROM room_types WHERE type_name = ?");
    $stmt->execute([$typeName]);
    if ($stmt->fetch()) {
        respond_json(400, ['success' => false, 'message' => 'Room type name already exists']);
    }
    
    // Insert new room type
    $stmt = $pdo->prepare("INSERT INTO room_types (type_name, capacity_adults, capacity_children, price_per_night) VALUES (?, ?, ?, ?)");
    $stmt->execute([$typeName, $capacityAdults, $capacityChildren, $pricePerNight]);
    
    $roomTypeId = $pdo->lastInsertId();
    
    respond_json(201, [
        'success' => true,
        'message' => 'Room type added successfully',
        'room_type_id' => $roomTypeId
    ]);
    
} catch (Throwable $e) {
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to add room type',
        'error' => $e->getMessage()
    ]);
}

?>
