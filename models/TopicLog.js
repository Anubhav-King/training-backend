// models/TopicLog.js
import mongoose from "mongoose";

const topicLogSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
  action: String, // "assign" | "unassign"
  entityType: String, // "jobTitle" | "user"
  entityValue: String, // job title or user ID
  changedBy: String,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model("TopicLog", topicLogSchema);
