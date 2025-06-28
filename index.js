// index.js (backend root)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

import topicRoutes from "./routes/topics.js";
import userRoutes from "./routes/users.js";
import progressRoutes from "./routes/progress.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:3000"];

// ✅ CORS middleware (don't use '*', use explicit origins)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `CORS policy: Origin ${origin} not allowed.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ✅ Parse incoming JSON
app.use(express.json());

// ✅ API routes
app.use("/api/auth", authRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/users", userRoutes);
app.use("/api/progress", progressRoutes);

// ✅ Optional ping test route
app.get("/ping", (req, res) => {
  res.send("✅ Backend is alive and CORS is working");
});

// ✅ DB connection and server start
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
  });
