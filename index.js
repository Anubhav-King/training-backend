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
const PORT = process.env.PORT || 5000;

// ✅ CORS middleware (don't use '*', use explicit origins)
app.use(cors({
  origin: true,
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
