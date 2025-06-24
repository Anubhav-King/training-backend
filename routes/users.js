import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

const router = express.Router();
const SALT_ROUNDS = 10;

// ✅ Unified Registration (Admin or normal user)
router.post("/register", async (req, res) => {
  const { name, mobile, password, jobTitles, isAdmin } = req.body;

  if (!name || !mobile || !password || !jobTitles || jobTitles.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existingUser = await User.findOne({ mobile });
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const filteredTitles = jobTitles.filter((t) => t !== "Admin");

  if (isAdmin && filteredTitles.length === 0) {
    return res.status(400).json({ error: "Admin must have another job title" });
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);

  const user = new User({
    name,
    mobile,
    password: hashed,
    jobTitles: filteredTitles,
    isAdmin,
    active: false,
    mustChangePassword: password === "Monday01",
    approvedBy: null,
  });

  await user.save();
  res.status(201).json({ message: "User registered and pending approval" });
});

// ✅ Approve User (Admin only)
router.post("/approve-user", async (req, res) => {
  const { userId, adminName } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.active = true;
  user.approvedBy = adminName;
  user.approvedAt = new Date(); // ✅ THIS is the missing field

  await user.save();

  res.json({ message: `User approved by ${adminName}` });
});


router.post("/deactivate-user", async (req, res) => {
  const { userId, adminName } = req.body;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Mark legacy users as approved upon deactivation
  if (!user.approvedBy) {
    user.approvedBy = adminName;
    user.approvedAt = new Date();
  }

  user.active = false;
  user.deactivatedBy = adminName;
  user.deactivatedAt = new Date();

  await user.save();
  res.json({ message: `User deactivated by ${adminName}` });
});

// ✅ Reactivate User
router.post("/reactivate-user", async (req, res) => {
  const { userId, code, adminName } = req.body;

  if (code !== "Boss@2025") {
    return res.status(403).json({ error: "Invalid reactivation code" });
  }

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  user.active = true;
  user.reactivatedBy = adminName;
  await user.save();

  res.json({ message: `User reactivated by ${adminName}` });
});

// ✅ Login with mobile
router.post("/login", async (req, res) => {
  const { mobile, password } = req.body;

  const user = await User.findOne({ mobile });
  if (!user) return res.status(404).json({ error: "User not found" });
  if (!user.active) return res.status(403).json({ error: "User is deactivated" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Incorrect password" });

  const token = jwt.sign(
    { userId: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRET || "King@2025",
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

router.post('/reset-password/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");

    const hashedPassword = await bcrypt.hash("Monday01", 10);
    user.password = hashedPassword;
    await user.save();

    res.send("Password reset to default");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to reset password");
  }
});


// ✅ Admin creates user directly (not pending)
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

export default router;
