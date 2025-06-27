import express from "express";
import Progress from "../models/Progress.js";
import User from "../models/User.js";
import Topic from "../models/Topic.js";

const router = express.Router();

// Track quiz attempt (existing)
router.post("/", async (req, res) => {
  const { userId, topicId, passed } = req.body;
  let record = await Progress.findOne({ userId, topicId });

  if (!record) {
    record = new Progress({ userId, topicId, attempts: 1, completed: passed });
  } else {
    record.attempts += 1;
    if (passed) record.completed = true;
  }

  await record.save();
  res.json({ message: "Progress updated" });
});

// Admin: get summary per user (FLATTENED)
router.get("/summary", async (req, res) => {
  try {
    const users = await User.find();
    const topics = await Topic.find();
    const progress = await Progress.find();

    const summary = users.map(user => {
      const assigned = topics.filter(t =>
        t.jobTitles.includes("All") ||
        t.jobTitles.some(j => user.jobTitles.includes(j))
      );

      const userProgress = progress.filter(p => p.userId.toString() === user._id.toString());

      const completedCount = userProgress.filter(p => p.completed).length;

      return {
        userId: user._id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.name,
        jobTitles: user.jobTitles || [],
        assignedCount: assigned.length,
        completedCount,
      };
    });

    res.json(summary);
  } catch (err) {
    console.error("Failed to fetch summary:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ✅ NEW: Get all progress entries for a specific user
router.get("/:userId", async (req, res) => {
  const userId = req.params.userId;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const assignedTopics = await Topic.find({
    $or: [
      { jobTitles: { $in: user.jobTitles } },
      { assignedTo: user._id },
      { jobTitles: "All" },
    ],
  });

  const progress = await Progress.find({ userId });

  const enriched = assignedTopics.map(topic => {
    const entry = progress.find(p => p.topicId.toString() === topic._id.toString());
    return {
      topicId: topic,
      completed: entry?.completed || false,
    };
  });

  res.json(enriched);
});

// ✅ NEW: Summary - One Row Per User
router.get("/user-summary", async (req, res) => {
  try {
    const users = await User.find();
    const progress = await Progress.find();
    const topics = await Topic.find();

    const summary = users.map(user => {
      const assigned = topics.filter(t =>
        t.jobTitles.includes("All") ||
        t.jobTitles.some(j => user.jobTitles.includes(j))
      );


      const userProgress = progress.filter(p => p.userId.toString() === user._id.toString());

      const completedCount = userProgress.filter(p => p.completed).length;

      return {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        jobTitles: user.jobTitles,
        assignedCount: assigned.length,
        completedCount,
      };
    });
    console.log("🧪 Summary result:", summary);
    res.json(summary);
  } catch (err) {
    console.error("Failed to fetch summary:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ NEW: Details - Topics & Attempts
router.get("/user/:userId/details", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const topics = await Topic.find({
      jobTitles: { $in: user.jobTitles }
    });

    const progress = await Progress.find({ userId });

    const details = topics.map(topic => {
      const entry = progress.find(p => p.topicId.toString() === topic._id.toString());
      return {
        title: topic.title,
        attempts: entry?.attempts || 0,
        completed: entry?.completed || false,
      };
    });

    res.json(details);
  } catch (err) {
    console.error("Failed to fetch details:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
