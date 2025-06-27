import mongoose from "mongoose";

const topicSchema = new mongoose.Schema({
  title: String,
  content: String,
  imageUrl: String,
  jobTitles: [String],
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  quiz: [
    {
      question: String,
      options: [String],
      correctAnswer: String,
    },
  ],
}, { timestamps: true });

export default mongoose.model("Topic", topicSchema);
