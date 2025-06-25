import express from "express";
import Topic from "../models/Topic.js";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// 📌 Add a new topic
router.post("/add", verifyToken, async (req, res) => {
  console.log("📥 New topic received:", req.body);
  try {
    const topic = new Topic(req.body);
    await topic.save();
    res.status(201).json(topic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save topic" });
  }
});

// 📌 Get assigned topics (🔁 FIXED: must come BEFORE /:id)
router.get("/assigned", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const topics = await Topic.find({
      $or: [
        { jobTitles: { $in: user.jobTitles } },
        { assignedTo: user._id },
        { jobTitles: "All" },
      ],
    });

    res.json(topics);
  } catch (err) {
    console.error("Failed to get assigned topics:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 Admin assigns topic
router.post("/assign", async (req, res) => {
  const { topicId, jobTitle, userId } = req.body;
  const topic = await Topic.findById(topicId);
  if (!topic) return res.status(404).json({ error: "Topic not found" });

  if (jobTitle && !topic.jobTitles.includes(jobTitle)) {
    topic.jobTitles.push(jobTitle);
  }

  if (userId && !topic.assignedTo.includes(userId)) {
    topic.assignedTo.push(userId);
  }

  await topic.save();
  res.json({ message: "Topic assigned" });
});

// 📌 Unassigned topics
router.get("/unassigned", async (req, res) => {
  try {
    const topics = await Topic.find({ jobTitles: { $size: 0 } }).sort({
      createdAt: -1,
    });
    res.json(topics);
  } catch (err) {
    console.error("Error fetching unassigned topics:", err);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

// 📌 Get topics for a specific user
router.get("/user/:userId", async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const topics = await Topic.find({
    $or: [
      { jobTitles: { $in: user.jobTitles } },
      { assignedTo: user._id },
      { jobTitles: "All" },
    ],
  });

  res.json(topics);
});

// ✅ MUST COME LAST: Get topic by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    res.json(topic);
  } catch (err) {
    console.error("Failed to get topic:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
