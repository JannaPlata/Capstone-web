import connectDB from "../configs/db.js";
export const getRecentBookings = async (req, res) => {
  try {
    const db = await connectDB();
    const { start, end, limit = 10 } = req.query;
    const dateFilter = start && end ? `WHERE DATE(b.created_at) BETWEEN '${start}' AND '${end}'` : '';

    const [rows] = await db.query(`
      SELECT 
        b.booking_id,
        COALESCE(u.full_name, 'Guest') AS guest_name,
        COALESCE(rt.type_name, '—') AS room_type,
        COALESCE(r.room_number, '—') AS room_number,
        DATE_FORMAT(b.check_in, '%Y-%m-%d') AS check_in,
        DATE_FORMAT(b.check_out, '%Y-%m-%d') AS check_out,
        b.payment_status,
        b.status
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.user_id
      LEFT JOIN room_types rt ON b.room_type_id = rt.room_type_id
      LEFT JOIN rooms r ON r.room_type_id = rt.room_type_id
      ${dateFilter}
      ORDER BY b.created_at DESC
      LIMIT ${Number(limit)};
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Error in getRecentBookings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recent bookings", error: error.message });
  }
};


export const getDashboardStats = async (req, res) => {
  try {
    const db = await connectDB(); // ADD THIS LINE
    const { start, end } = req.query;
    const dateFilter = start && end ? `WHERE DATE(created_at) BETWEEN '${start}' AND '${end}'` : '';

    const queries = [
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter}`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} payment_status = 'pending'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'confirmed'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'checked-in'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'checked-out'`),
      db.query(`SELECT COUNT(*) AS count FROM bookings ${dateFilter ? dateFilter + " AND" : "WHERE"} status = 'cancelled'`)
    ];

    const [
      [total],
      [pending],
      [confirmed],
      [checkedIn],
      [checkedOut],
      [cancelled]
    ] = await Promise.all(queries);

    res.json({
      success: true,
      data: {
        total_bookings: total[0].count || 0,
        pending_bookings: pending[0].count || 0,
        confirmed_bookings: confirmed[0].count || 0,
        checked_in: checkedIn[0].count || 0,
        checked_out: checkedOut[0].count || 0,
        cancelled: cancelled[0].count || 0
      }
    });
  } catch (error) {
    console.error("Error in getDashboardStats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats", error: error.message });
  }
};

export const getBookingTrends = async (req, res) => {
  try {
    const db = await connectDB(); // ADD THIS LINE
    const { start, end } = req.query;
    const dateFilter = start && end ? `WHERE DATE(created_at) BETWEEN '${start}' AND '${end}'` : '';
    
    const [trends] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%b %Y') AS month, COUNT(*) AS count
      FROM bookings
      ${dateFilter}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY created_at DESC
      LIMIT 12
    `);
    
    res.json({ 
      success: true, 
      data: {
        labels: trends.map(t => t.month),
        counts: trends.map(t => t.count)
      }
    });
  } catch (error) {
    console.error("Error in getBookingTrends:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking trends", error: error.message });
  }
};