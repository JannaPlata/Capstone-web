<?php
declare(strict_types=1);
require_once __DIR__ . '/../../db.php';
require_once __DIR__ . '/../../helper.php';


ini_set('display_errors', '1'); // string, not int
ini_set('display_startup_errors', '1'); // optional, also string
error_reporting(E_ALL);



try {
    $input = json_decode(file_get_contents('php://input'), true);
    $ids = $input['ids'] ?? [];

    if (empty($ids)) {
        respond_json(400, ['success' => false, 'message' => 'No room IDs provided']);
    }

    $pdo = get_pdo();
    $pdo->beginTransaction();

    foreach ($ids as $roomId) {
        $stmt = $pdo->prepare("DELETE FROM rooms WHERE room_id = ?");
        $stmt->execute([$roomId]);
    }

    $pdo->commit();

    respond_json(200, [
        'success' => true,
        'message' => count($ids) . ' room(s) deleted successfully'
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    respond_json(500, [
        'success' => false,
        'message' => 'Failed to delete rooms',
        'error' => $e->getMessage()
    ]);
}
