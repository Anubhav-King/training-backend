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

// Admin: get summary per user
router.get("/summary", async (req, res) => {
  const users = await User.find();
  const topics = await Topic.find();
  const progress = await Progress.find().populate("userId").populate("topicId");

  const summary = users.map((user) => {
    const userProgress = progress.filter(p => p.userId._id.equals(user._id));
    return {
      user: {
        name: user.name,
        email: user.email,
        jobTitles: user.jobTitles,
      },
      topics: topics.map(t => {
        const match = userProgress.find(p => p.topicId._id.equals(t._id));
        return {
          topicTitle: t.title,
          completed: match?.completed || false,
          attempts: match?.attempts || 0
        };
      })
    };
  });

  res.json(summary);
});

export default router;
