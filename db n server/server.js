// server.js
import express from "express";
import "dotenv/config";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";

import connectDB from "./configs/db.js";
import connectCloudinary from "./configs/cloudinary.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import hotelRoutes from "./routes/hotelRoutes.js";
import roomRoutes from "./routes/roomRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import newsletter from "./routes/newsletter.js";
import eventBookings from "./routes/eventBookings.js";
import dashboardRoute from "./routes/dashboardRoute.js";

//  Initialize DB + Cloudinary
connectDB();
connectCloudinary();

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

//  Session middleware (required for Passport)
app.use(
  session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

//  Configure Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID, // from Google Cloud Console
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const db = await connectDB();

        // check if user exists
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
          profile.emails[0].value,
        ]);

        let user;
        if (rows.length > 0) {
          user = rows[0];
        } else {
          // insert new Google user
          const [result] = await db.query(
            "INSERT INTO users (full_name, email) VALUES (?, ?)",
            [
              profile.displayName,
              profile.emails[0].value,
            ]
          );
          const [newUser] = await db.query(
            "SELECT * FROM users WHERE user_id = ?",
            [result.insertId]
          );
          user = newUser[0];
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.user_id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const db = await connectDB();
    const [rows] = await db.query("SELECT * FROM users WHERE user_id = ?", [
      id,
    ]);
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

//  Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/hotel", hotelRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/newsletter", newsletter);
app.use("/api/eventBookings", eventBookings);
app.use("/api/dashboard", dashboardRoute);
// Test route
app.get("/", (req, res) => res.send("API is working fine"));

//  Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
