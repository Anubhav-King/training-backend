import express from "express";
import Topic from "../models/Topic.js";
import User from "../models/User.js";
import TopicLog from "../models/TopicLog.js";
import { verifyToken } from "../middleware/auth.js";
import { getAdminFromToken } from "../utils/getAdminFromToken.js";
import { Parser } from 'json2csv';
import { format } from 'date-fns';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import TopicUpdateLog from '../models/TopicUpdateLog.js';
import isEqual from 'lodash/isEqual.js';

const upload = multer();

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

    let topics;

    if (user.isAdmin) {
      // Admins can see all topics that are assigned to someone
      topics = await Topic.find({
        $or: [
          { jobTitles: { $exists: true, $not: { $size: 0 } } },
          { assignedTo: { $exists: true, $not: { $size: 0 } } }
        ]
      });
    } else {
      topics = await Topic.find({
        $or: [
          { jobTitles: { $in: user.jobTitles } },
          { assignedTo: user._id },
          { jobTitles: "All" },
        ]
      });
    }

    res.json(topics);
  } catch (err) {
    console.error(err);
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

// ------------------
// ** IMPORTANT: Route order for fixed routes above dynamic ones **
// ------------------

// 📌 Export topics CSV (updated format)
router.get("/csv/export", verifyToken, async (req, res) => {
  try {
    const topics = await Topic.find();

    const data = topics.map(topic => {
      // Extract sections from HTML content
      const getSection = (html, section) => {
        const match = html.match(new RegExp(`<h2>${section}</h2>(.*?)<h2>|<h2>${section}</h2>(.*)$`, 'is'));
        return match ? (match[1] || match[2] || '').replace(/<\/?[^>]+(>|$)/g, '').trim() : '';
      };

      const objective = getSection(topic.content, "Objective");
      const process = getSection(topic.content, "Process Explained");
      const task = getSection(topic.content, "Task Breakdown");
      const selfCheck = getSection(topic.content, "Self Check");

      const quiz = topic.quiz || [];

      return {
        title: topic.title,
        objective,
        process_explained: process,
        task_breakdown: task,
        self_check: selfCheck,

        q1_question: quiz[0]?.question || '',
        q1_option1: quiz[0]?.options?.[0] || '',
        q1_option2: quiz[0]?.options?.[1] || '',
        q1_option3: quiz[0]?.options?.[2] || '',
        q1_option4: quiz[0]?.options?.[3] || '',
        q1_correct: quiz[0]?.correctAnswer || '',

        q2_question: quiz[1]?.question || '',
        q2_option1: quiz[1]?.options?.[0] || '',
        q2_option2: quiz[1]?.options?.[1] || '',
        q2_option3: quiz[1]?.options?.[2] || '',
        q2_option4: quiz[1]?.options?.[3] || '',
        q2_correct: quiz[1]?.correctAnswer || '',

        q3_question: quiz[2]?.question || '',
        q3_option1: quiz[2]?.options?.[0] || '',
        q3_option2: quiz[2]?.options?.[1] || '',
        q3_option3: quiz[2]?.options?.[2] || '',
        q3_option4: quiz[2]?.options?.[3] || '',
        q3_correct: quiz[2]?.correctAnswer || '',

        q4_question: quiz[3]?.question || '',
        q4_option1: quiz[3]?.options?.[0] || '',
        q4_option2: quiz[3]?.options?.[1] || '',
        q4_option3: quiz[3]?.options?.[2] || '',
        q4_option4: quiz[3]?.options?.[3] || '',
        q4_correct: quiz[3]?.correctAnswer || ''
      };
    });

    const parser = new Parser();
    const csv = parser.parse(data);

    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    res.header("Content-Type", "text/csv");
    res.attachment(`topics_export_${timestamp}.csv`);
    return res.send(csv);
  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).json({ error: "Failed to export topics as CSV" });
  }
});


// 📌 Import topics CSV (updated format)
router.post("/csv/import", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const adminName = await getAdminFromToken(req);
    if (!req.file) return res.status(400).json({ error: "CSV file is required" });

    const results = [];
    const stream = Readable.from(req.file.buffer);

stream
.pipe(csvParser())
.on("data", (data) => results.push(data))
.on("end", async () => {
  const logs = [];

  for (const row of results) {
    const existing = await Topic.findOne({ title: row.title });

    const content = `
      <h2>Objective</h2><p>${row.objective || ""}</p>
      <h2>Process Explained</h2><p>${row.process_explained || ""}</p>
      <h2>Task Breakdown</h2><p>${row.task_breakdown || ""}</p>
      <h2>Self Check</h2><p>${row.self_check || ""}</p>
    `.replace(/\n/g, "").trim();

    const quiz = [];
    for (let i = 1; i <= 4; i++) {
      const question = row[`q${i}_question`];
      const options = [1, 2, 3, 4].map(n => row[`q${i}_option${n}`]).filter(Boolean);
      const correct = row[`q${i}_correct`];
      if (question && options.length === 4 && correct) {
        quiz.push({ question, options, correctAnswer: correct });
      }
    }

    if (existing) {
      const contentChanged = existing.content !== content;
      const quizChanged = !isEqual(existing.quiz, quiz);

      const updatedFields = {};
      if (contentChanged) {
        updatedFields.content = { from: existing.content, to: content };
        existing.content = content;
      }
      if (quizChanged) {
        updatedFields.quiz = { from: existing.quiz, to: quiz };
        existing.quiz = quiz;
      }

      if (Object.keys(updatedFields).length > 0) {
        await existing.save();
        logs.push({
          topicId: existing._id,
          title: existing.title,
          updatedBy: adminName,
          updatedFields,
          timestamp: new Date()
        });
      }
    } else {
      console.log("🆕 Creating new topic:", row.title);

      const newTopic = new Topic({
        title: row.title,
        content,
        quiz,
        jobTitles: [],
        assignedTo: [],
      });
      await newTopic.save();

      const newLog = {
        topicId: newTopic._id,
        title: newTopic.title,
        updatedBy: adminName,
        updatedFields: {
          content: { from: "", to: content },
          quiz: { from: [], to: quiz }
        },
        timestamp: new Date()
      };

      console.log("📝 Logging new topic creation:", newLog);
      logs.push(newLog);
    }
  }

  await TopicUpdateLog.insertMany(logs);
  console.log("📦 Inserted logs:", logs.length);
  res.json({ message: "Topics upserted successfully", updated: logs.length });
});


  } catch (err) {
    console.error("CSV Import Error:", err);
    res.status(500).json({ error: "Failed to import CSV" });
  }
});

router.get("/update-logs", verifyToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const total = await TopicUpdateLog.countDocuments();
    const logs = await TopicUpdateLog.find()
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("Fetch logs error:", err);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// 📌 PATCH: Update topic images section-wise
router.patch("/:id/images", verifyToken, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const { section, urls, replace } = req.body;
    if (!section || !Array.isArray(urls)) {
      return res.status(400).json({ error: "Section and array of image URLs required" });
    }

    const validSections = ["objective", "process", "task", "selfCheck"];

    const key = section.toLowerCase().replace(/\s/g, '');
    const mapping = {
      objective: "objective",
      processexplained: "process",
      taskbreakdown: "task",
      selfcheck: "selfCheck"
    };
    const field = mapping[key];
    if (!validSections.includes(field)) {
      return res.status(400).json({ error: "Invalid section name" });
    }

    if (replace) {
      // Replace entire array
      topic.images[field] = urls;
    } else {
      // Append URLs to existing array
      topic.images[field] = [...(topic.images[field] || []), ...urls];
    }

    await topic.save();

    res.json({ message: `Images ${replace ? "replaced" : "added"} to ${field}`, images: topic.images[field] });
  } catch (err) {
    console.error("Error updating topic images:", err);
    res.status(500).json({ error: "Failed to update topic images" });
  }
});

// GET all topics (assigned and unassigned)
router.get("/", verifyToken, async (req, res) => {
  try {
    const topics = await Topic.find().sort({ createdAt: -1 });
    res.json(topics);
  } catch (err) {
    console.error("Failed to fetch all topics:", err);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});




// 📌 Get topic by ID (dynamic route, last)
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
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const adminName = await getAdminFromToken(req);
    const { content, quiz } = req.body;

    const updatedFields = {};

    // Compare content
    if (content && content !== topic.content) {
      updatedFields.content = {
        from: topic.content,
        to: content
      };
      topic.content = content;
    }

    // Compare quiz (deep comparison)
    if (quiz && !isEqual(quiz, topic.quiz)) {
      updatedFields.quiz = {
        from: topic.quiz,
        to: quiz
      };
      topic.quiz = quiz;
    }

    // Only log if something changed
    if (Object.keys(updatedFields).length > 0) {
      await TopicUpdateLog.create({
        topicId: topic._id,
        title: topic.title,
        updatedFields,
        updatedBy: adminName
      });
    }

    await topic.save();
    res.json(topic);
  } catch (err) {
    console.error("Update topic error:", err);
    res.status(500).json({ error: "Failed to update topic" });
  }
});



export default router;
