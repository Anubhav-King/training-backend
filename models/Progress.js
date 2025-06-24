import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: "Topic" },
  completed: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
});

export default mongoose.model("Progress", progressSchema);
