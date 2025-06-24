import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import topicRoutes from "./routes/topics.js";
import userRoutes from "./routes/users.js";
import progressRoutes from "./routes/progress.js";
import authRoutes from './routes/auth.js'

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

//app.use((req, res, next) => {
 // console.log(`🛸 [${req.method}] ${req.url}`);
 // next();
//});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});


// ✅ CORS middleware FIRST (fixes CORS preflight errors)
app.use(cors({
  origin: [
    'https://4ffeb605-be9f-4e47-8497-703baa7c287e-00-1gbms4ztnz5hi.pike.replit.dev', // your frontend URL
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ Parse JSON bodies
app.use(express.json());

// ✅ Your routes (after cors + json middleware)
app.use("/api/auth", authRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/users", userRoutes);
app.use("/api/progress", progressRoutes);

// ✅ Connect DB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
  });
