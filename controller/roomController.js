
import { v2 as cloudinary } from "cloudinary";
import connectDB from "../configs/db.js";

//Api to create new room for the hotel
export const createRoom = async (req, res) => {
    try {
        const {roomType, pricePerNight, amenities} = req.body;
        const hotel = await Hotel.findOne({owner: req.auth.userId})

        if (!hotel){
            return res.json({
                success: false,
                message: "Hotel not found"
            })
        }
        const uploadImages = req.files.map(async (file) => {
            const response = await cloudinary.uploader.upload(file.path);
            return response.secure_url;
        })

        const images = await Promise.all(uploadImages)

        await Room.create({
            hotel: hotel._id,
            roomType,
            pricePerNight: +pricePerNight,
            amenities: JSON.parse(amenities),
            images,
        })
        res.json({
            success:true,
            message:"Room created successfully"
        })
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
//Api to get all rooms of the hotel
export const getRooms = async (req, res) => {
    try {
        const rooms = await Room.find({isAvailable: true}).populate({
            path: "hotel",
            populate: {
                path: "owner",
                select: 'image'
            }
        }).sort({createdAt: -1});
        res.json({
            success:true,
            rooms
        })      
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
//API to get all rooms for a specific hotel
export const getOwnerRooms = async (req, res) => {
    try {
        const hotelData = await Hotel({owner: req.auth.userId})
        const rooms = await Room.find({hotel: hotelData._id.toString()}).populate("hotel");
        res.json ({
            success: true,
            rooms
        });
    } catch (error) {
        res.json({
            success: false,
            message: error.message
        })
    }
}
//API to toggle availability of a room
export const checkRoomAvailability = async (req, res) => {
  try {
    const { room_number } = req.params;

    const db = await connectDB();

    const [results] = await db.query("SELECT * FROM rooms WHERE room_number = ?", [room_number]);

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    const room = results[0];
 
    if (room.status !== "available") {
      return res.json({
        success: false,
        message: "This room is not available for the following days.",
      });
    }

    return res.json({
      success: true,
      message: "Room is available",
      room,
    });
  } catch (error) {
    console.error("❌ Error checking room:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =================== ADMIN FUNCTIONS ===================

// Helper function to sanitize strings
const sanitizeString = (str) => {
  if (!str) return '';
  return String(str).trim();
};

// Admin: Get all rooms with filters
export const adminGetRooms = async (req, res) => {
  try {
    const db = await connectDB();
    
    const { search, room_type, status } = req.query;
    
    const whereConditions = [];
    const params = [];
    
    // Search filter: room_number OR type_name
    if (search && search.trim() !== '') {
      const searchTerm = `%${sanitizeString(search)}%`;
      whereConditions.push("(r.room_number LIKE ? OR rt.type_name LIKE ?)");
      params.push(searchTerm, searchTerm);
    }
    
    // Room type filter
    if (room_type && room_type !== 'all') {
      whereConditions.push("rt.type_name = ?");
      params.push(sanitizeString(room_type));
    }
    
    // Status filter
    if (status && status !== 'all') {
      whereConditions.push("r.status = ?");
      params.push(sanitizeString(status));
    }
    
    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';
    
    const sql = `
      SELECT 
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
      ${whereClause}
      ORDER BY r.room_number
    `;
    
    const [rooms] = await db.query(sql, params);
    
    res.json({
      success: true,
      count: rooms.length,
      data: rooms,
      message: rooms.length === 0 ? 'No rooms found' : ''
    });
    
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms',
      error: error.message
    });
  }
};

// Admin: Add new room
export const adminAddRoom = async (req, res) => {
  try {
    const db = await connectDB();
    const { room_number, room_type, room_type_id, price_per_night, capacity_adults, capacity_children, status } = req.body;
    
    // Validate required fields
    if (!room_number || room_number.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Room number is required' 
      });
    }
    
    if (!room_type && !room_type_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Room type is required' 
      });
    }
    
    let roomTypeId = null;
    
    // If room_type_id is provided, validate it exists
    if (room_type_id) {
      const [existingType] = await db.query(
        "SELECT room_type_id FROM room_types WHERE room_type_id = ?",
        [parseInt(room_type_id)]
      );
      
      if (existingType.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid room type selected' 
        });
      }
      
      roomTypeId = parseInt(room_type_id);
    } else {
      // If room_type name is provided, find or create it
      const roomTypeName = sanitizeString(room_type);
      
      const [existingType] = await db.query(
        "SELECT room_type_id FROM room_types WHERE type_name = ?",
        [roomTypeName]
      );
      
      if (existingType.length > 0) {
        roomTypeId = existingType[0].room_type_id;
      } else {
        // Create new room type
        const [result] = await db.query(
          "INSERT INTO room_types (type_name, price_per_night, capacity_adults, capacity_children) VALUES (?, ?, ?, ?)",
          [
            roomTypeName,
            parseInt(price_per_night || 0),
            parseInt(capacity_adults || 0),
            parseInt(capacity_children || 0)
          ]
        );
        roomTypeId = result.insertId;
      }
    }
    
    // Check for duplicate room
    const [duplicate] = await db.query(
      "SELECT room_id FROM rooms WHERE room_number = ? AND room_type_id = ?",
      [sanitizeString(room_number), roomTypeId]
    );
    
    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Room number already exists for this room type.'
      });
    }
    
    // Insert room
    const roomStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : 'Available';
    
    await db.query(
      "INSERT INTO rooms (room_number, room_type_id, status) VALUES (?, ?, ?)",
      [sanitizeString(room_number), roomTypeId, roomStatus]
    );
    
    res.json({ 
      success: true, 
      message: 'Room added successfully' 
    });
    
  } catch (error) {
    console.error('Add room error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database error: ' + error.message 
    });
  }
};

// Admin: Update room
export const adminUpdateRoom = async (req, res) => {
  try {
    const db = await connectDB();
    const { room_id, room_number, room_type_id, status } = req.body;
    
    if (!room_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Room ID is required' 
      });
    }
    
    const updates = [];
    const params = [];
    
    // Build dynamic UPDATE query
    if (room_number !== undefined) {
      updates.push("room_number = ?");
      params.push(sanitizeString(room_number));
    }
    
    if (room_type_id !== undefined) {
      updates.push("room_type_id = ?");
      params.push(parseInt(room_type_id));
    }
    
    if (status !== undefined) {
      const roomStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
      updates.push("status = ?");
      params.push(roomStatus);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nothing to update' 
      });
    }
    
    params.push(parseInt(room_id));
    
    const sql = `UPDATE rooms SET ${updates.join(", ")} WHERE room_id = ?`;
    
    await db.query(sql, params);
    
    res.json({ 
      success: true, 
      message: 'Room updated successfully' 
    });
    
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Admin: Delete room(s)
export const adminDeleteRoom = async (req, res) => {
  let connection;
  
  try {
    const db = await connectDB();
    connection = await db.getConnection();
    
    const { room_id, room_ids, ids } = req.body;
    
    let roomIds = [];
    
    // Normalize IDs from different possible fields
    if (room_id) {
      roomIds.push(parseInt(room_id));
    } else if (room_ids && Array.isArray(room_ids)) {
      roomIds = room_ids.map(id => parseInt(id));
    } else if (ids && Array.isArray(ids)) {
      roomIds = ids.map(id => parseInt(id));
    }
    
    if (roomIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No room IDs provided' 
      });
    }
    
    await connection.beginTransaction();
    
    let deletedCount = 0;
    const skippedActive = [];
    
    for (const roomId of roomIds) {
      // Check if room exists
      const [roomRows] = await connection.query(
        "SELECT room_number FROM rooms WHERE room_id = ? FOR UPDATE",
        [roomId]
      );
      
      if (roomRows.length === 0) continue;
      
      const room = roomRows[0];
      
      // Check for active bookings
      const [activeBookings] = await connection.query(
        `SELECT COUNT(*) as count FROM booking_rooms br
         JOIN bookings b ON b.booking_id = br.booking_id
         WHERE br.room_id = ? AND b.status IN ('Confirmed', 'Checked-in')`,
        [roomId]
      );
      
      if (activeBookings[0].count > 0) {
        skippedActive.push(room.room_number || roomId);
        continue;
      }
      
      // Delete associated booking_rooms entries
      await connection.query("DELETE FROM booking_rooms WHERE room_id = ?", [roomId]);
      
      // Delete room
      await connection.query("DELETE FROM rooms WHERE room_id = ?", [roomId]);
      
      deletedCount++;
    }
    
    await connection.commit();
    
    let message = `${deletedCount} room(s) deleted successfully.`;
    if (skippedActive.length > 0) {
      message += ` Skipped rooms with active bookings: ${skippedActive.join(', ')}`;
    }
    
    res.json({
      success: true,
      message,
      deleted: deletedCount,
      skipped: skippedActive
    });
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Delete room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rooms',
      error: error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};