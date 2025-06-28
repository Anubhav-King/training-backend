import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js"; // ✅ Correct

dotenv.config();

const router = express.Router();
const SALT_ROUNDS = 10;
const SECRET = "someStrongSecret"; // Hardcoded for token verification and signing

// Utility: Get admin user from token
const getAdminFromToken = async (req) => {
  const token = req.headers.authorization?.split(" ")[1];
  console.log("👉 TOKEN RECEIVED:", token); // ✅ debug
  if (!token) throw { status: 401, message: "Missing token" };

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch {
    throw { status: 401, message: "Invalid token" };
  }

  const adminUser = await User.findById(decoded.userId);
  if (!adminUser || !adminUser.isAdmin) {
    throw { status: 403, message: "Only admins allowed" };
  }

  return adminUser;
};

// ✅ Unified Registration (Admin or normal user)
router.post("/register", async (req, res) => {
  const { name, mobile, password, jobTitles, isAdmin } = req.body;

  if (!name || !mobile || !password || !jobTitles?.length) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existingUser = await User.findOne({ mobile });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const filteredTitles = jobTitles.filter((t) => t !== "Admin");
  const isAdminFromClient = req.body.isAdmin === true;

  if (isAdminFromClient && filteredTitles.length === 0) {
    return res.status(400).json({ error: "Admin must have another job title" });
  }


  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = new User({
    name,
    mobile,
    password: hashed,
    jobTitles: filteredTitles,
    isAdmin: isAdminFromClient,
    active: false,
    mustChangePassword: password === "Monday01",
    approvedBy: null,
  });

  await user.save();
  res.status(201).json({ message: "User registered and pending approval" });
});

// ✅ Approve User
router.post("/approve-user", async (req, res) => {
  try {
    const admin = await getAdminFromToken(req);
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.active = true;
    user.approvedBy = admin.name;
    user.approvedAt = new Date();

    await user.save();
    res.json({ message: `User approved by ${admin.name}` });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
});

// ✅ Deactivate User
router.post("/deactivate-user", async (req, res) => {
  try {
    const admin = await getAdminFromToken(req);
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.approvedBy) {
      user.approvedBy = admin.name;
      user.approvedAt = new Date();
    }

    user.active = false;
    user.deactivatedBy = admin.name;
    user.deactivatedAt = new Date();

    await user.save();
    res.json({ message: `User deactivated by ${admin.name}` });
  } catch (err) {
    console.error("Deactivate error:", err);
    res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
});

// ✅ Reactivate User
router.post("/reactivate-user", async (req, res) => {
  try {
    const admin = await getAdminFromToken(req);
    const { userId, code } = req.body;

    if (code !== "Boss@2025") {
      return res.status(403).json({ error: "Invalid reactivation code" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.active = true;
    user.reactivatedBy = admin.name;
    user.reactivatedAt = new Date();

    await user.save();
    res.json({ message: `User reactivated by ${admin.name}` });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
});

// ✅ Reset Password
router.post("/reset-password/:userId", async (req, res) => {
  try {
    const admin = await getAdminFromToken(req);
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    const hashedPassword = await bcrypt.hash("Monday01", SALT_ROUNDS);
    user.password = hashedPassword;
    user.mustChangePassword = true;
    user.passwordResetBy = admin.name;
    user.passwordResetAt = new Date();

    await user.save();
    res.send("Password reset to default");
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
});

// ✅ Login with mobile
router.post("/login", async (req, res) => {
  const { mobile, password } = req.body;

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.active)
    return res.status(403).json({ error: "User is deactivated" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Incorrect password" });

  const token = jwt.sign(
    { userId: user._id, isAdmin: user.isAdmin },
    SECRET,
    { expiresIn: "2h" }
  );

  res.json({
    token,
    mustChangePassword: user.mustChangePassword,
    user: {
      userId: user._id,
      name: user.name,
      mobile: user.mobile,
      jobTitles: user.jobTitles,
      isAdmin: user.isAdmin,
    },
  });
});

// ✅ Change Password
router.post("/change-password", async (req, res) => {
  const { userId, newPassword } = req.body;

  if (newPassword === "Monday01") {
    return res.status(400).json({ error: "You must choose a new password" });
  }

  const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await User.findByIdAndUpdate(userId, {
    password: hashed,
    mustChangePassword: false,
  });

  res.json({ message: "Password updated successfully" });
});

// ✅ Admin creates user directly (approved & active)
router.post("/add-user", async (req, res) => {
  const { name, mobile, jobTitle } = req.body;

  try {
    const hashed = await bcrypt.hash("Monday01", SALT_ROUNDS);

    const user = new User({
      name,
      mobile,
      password: hashed,
      jobTitles: [jobTitle],
      isAdmin: false,
      mustChangePassword: true,
      active: true,
    });

    await user.save();
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: "User exists or error saving" });
  }
});

// ✅ List All Users
router.get("/list", async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
});

// routes/users.js
router.patch('/update-jobtitles/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { jobTitles, code } = req.body;

  if (code !== 'Boss@2025') {
    return res.status(403).json({ error: "Invalid passcode" });
  }

  try {
    const admin = await getAdminFromToken(req);
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.jobTitles = jobTitles;

    // Append to logs
    const logEntry = {
      changedBy: admin.name,
      timestamp: new Date(),
      jobTitles
    };
    if (!user.jobTitleLogs) user.jobTitleLogs = [];
    user.jobTitleLogs.push(logEntry);

    await user.save();
    res.json({ message: "Job titles updated", jobTitles });
  } catch (err) {
    console.error("Failed to update job titles:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get job title logs for a specific user
router.get('/joblogs/:id', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("jobTitleLogs");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ logs: user.jobTitleLogs || [] });
  } catch (err) {
    console.error("Failed to get job title logs:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
