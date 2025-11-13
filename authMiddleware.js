// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import connectDB from "../configs/db.js";

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // --- ADMIN BYPASS ---
  if (req.headers["x-admin-key"] === "your-admin-secret") {
    req.user = { role: "admin", full_name: "Admin" };
    return next();
  }

  // --- JWT PROTECTION ---
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB using decoded id
    const db = await connectDB();
    const [rows] = await db.query("SELECT * FROM users WHERE user_id = ?", [
      decoded.id,
    ]);

    if (rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    req.user = { ...rows[0], user_id: decoded.id, email: decoded.user_email };
    next();
  } catch (err) {
    console.error("JWT Error:", err);
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};
