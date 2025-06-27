import mongoose from "mongoose";

const topicUpdateLogSchema = new mongoose.Schema({
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Topic",
    required: true
  },
  title: String,
  updatedFields: {
    content: {
      from: String,
      to: String
    },
    quiz: {
      from: Array,
      to: Array
    }
  },
  updatedBy: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("TopicUpdateLog", topicUpdateLogSchema);
