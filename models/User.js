import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  mobile: { type: String, unique: true },
  password: String,
  jobTitles: [String],
  isAdmin: Boolean,
  mustChangePassword: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  approved: { type: Boolean, default: false },

  approvedBy: String,
  approvedAt: Date,

  deactivatedBy: String,
  deactivatedAt: Date,

  reactivatedBy: String,
  reactivatedAt: Date,

  passwordResetBy: String,
  passwordResetAt: Date,

  jobTitleLogs: [
    {
      changedBy: String,
      timestamp: Date,
      jobTitles: [String]
    }
  ]
  
});

const User = mongoose.model('User', userSchema);
export default User;
