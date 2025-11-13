import express from "express";
import {
  getDashboardStats,
  getRecentBookings,
  getBookingTrends
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get("/recent-bookings", getRecentBookings);
router.get("/trends", getBookingTrends);

export default router;
