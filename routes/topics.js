import express from "express";
import Topic from "../models/Topic.js";
import User from "../models/User.js";
import TopicLog from "../models/TopicLog.js";
import { verifyToken } from "../middleware/auth.js";
import { getAdminFromToken } from "../utils/getAdminFromToken.js";

const router = express.Router();

// 📌 Add a new topic
router.post("/add", verifyToken, async (req, res) => {
  try {
    const topic = new Topic(req.body);
    await topic.save();
    res.status(201).json(topic);
  } catch (err) {
    res.status(500).json({ error: "Failed to save topic" });
  }
});

// 📌 Get assigned topics for current user
router.get("/assigned", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 Admin assigns topic
router.post("/assign", verifyToken, async (req, res) => {
  const { topicId, jobTitle, userId } = req.body;

  const topic = await Topic.findById(topicId);
  if (!topic) return res.status(404).json({ error: "Topic not found" });

  const admin = await getAdminFromToken(req);

  if (jobTitle && !topic.jobTitles.includes(jobTitle)) {
    topic.jobTitles.push(jobTitle);
    await TopicLog.create({
      topicId,
      action: "assign",
      entityType: "jobTitle",
      entityValue: jobTitle,
      changedBy: admin,
    });
  }

  if (userId && !topic.assignedTo.includes(userId)) {
    topic.assignedTo.push(userId);
    await TopicLog.create({
      topicId,
      action: "assign",
      entityType: "user",
      entityValue: userId,
      changedBy: admin,
    });
  }

  await topic.save();
  res.json({ message: "Topic assigned" });
});

// 📌 Unassigned topics
router.get("/unassigned", verifyToken, async (req, res) => {
  try {
    const topics = await Topic.find({ jobTitles: { $size: 0 }, assignedTo: { $size: 0 } }).sort({
      createdAt: -1,
    });
    res.json(topics);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

// 📌 Unassign topic
router.post("/unassign", verifyToken, async (req, res) => {
  const { topicId, jobTitle, userId } = req.body;

  const topic = await Topic.findById(topicId);
  if (!topic) return res.status(404).json({ error: "Topic not found" });

  const admin = await getAdminFromToken(req);

  if (jobTitle && topic.jobTitles.includes(jobTitle)) {
    topic.jobTitles = topic.jobTitles.filter((title) => title !== jobTitle);
    await TopicLog.create({
      topicId,
      action: "unassign",
      entityType: "jobTitle",
      entityValue: jobTitle,
      changedBy: admin,
    });
  }

  if (userId && topic.assignedTo.includes(userId)) {
    topic.assignedTo = topic.assignedTo.filter(id => id.toString() !== userId);
    await TopicLog.create({
      topicId,
      action: "unassign",
      entityType: "user",
      entityValue: userId,
      changedBy: admin,
    });
  }

  await topic.save();
  res.json({ message: "Topic unassigned successfully" });
});

// 📌 Get topic logs (used for both assigned & unassigned views)
router.get("/logs/:topicId", verifyToken, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.topicId);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const logs = await TopicLog.find({ topicId: topic._id }).sort({ timestamp: -1 });

    const jobTitleLogs = logs
      .filter(log => log.entityType === "jobTitle")
      .map(log => ({
        action: log.action,
        jobTitle: log.entityValue,
        adminName: log.changedBy,
        timestamp: log.timestamp
      }));

    const userLogs = logs
      .filter(log => log.entityType === "user")
      .map(log => ({
        action: log.action,
        userId: log.entityValue,
        adminName: log.changedBy,
        timestamp: log.timestamp
      }));

    res.json({
      [topic._id]: {
        title: topic.title,
        jobTitleLogs,
        userLogs
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch topic logs" });
  }
});

// 📌 Get all logs of fully unassigned topics
router.get("/unassigned/logs", verifyToken, async (req, res) => {
  try {
    const topics = await Topic.find({ jobTitles: { $size: 0 }, assignedTo: { $size: 0 } });
    const topicIds = topics.map(t => t._id);

    const logs = await TopicLog.find({ topicId: { $in: topicIds } }).sort({ timestamp: -1 });

    const groupedLogs = {};
    for (const topic of topics) {
      groupedLogs[topic._id] = {
        title: topic.title,
        jobTitleLogs: [],
        userLogs: []
      };
    }

    for (const log of logs) {
      const entry = groupedLogs[log.topicId];
      if (!entry) continue;

      if (log.entityType === "jobTitle") {
        entry.jobTitleLogs.push({
          action: log.action,
          jobTitle: log.entityValue,
          adminName: log.changedBy,
          timestamp: log.timestamp
        });
      } else if (log.entityType === "user") {
        entry.userLogs.push({
          action: log.action,
          userId: log.entityValue,
          adminName: log.changedBy,
          timestamp: log.timestamp
        });
      }
    }

    res.json(groupedLogs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch unassigned topic logs" });
  }
});


// 📌 Get topic by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });
    res.json(topic);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// 📌 Get topic by title (for CLI script)
router.get("/search", verifyToken, async (req, res) => {
  const { title } = req.query;
  if (!title) return res.status(400).json({ error: "Title query is required" });

  const topics = await Topic.find({ title: new RegExp(`^${title}$`, 'i') });
  res.json(topics);
});

// 📌 Update topic by ID
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const updated = await Topic.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          content: req.body.content,
          quiz: req.body.quiz
        }
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Topic not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update topic" });
  }
});


export default router;
