import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
  title: String,
  objective: String,
  process: String,
  breakdown: String,
  selfCheck: String,
  imageUrl: String,
  jobTitles: [String], // ["Technician", "All"] etc.
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // optional
  quiz: [
    {
      question: String,
      options: [String],
      correctAnswer: String,
    },
  ],
});

export default mongoose.model("Topic", topicSchema);
