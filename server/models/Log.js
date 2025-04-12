const mongoose = require("mongoose");

const LogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      "html-css",
      "javascript",
      "node",
      "express",
      "mongodb",
      "project",
      "other",
    ], // Add 'other' or adjust as needed
    default: "other",
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  importance: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 3,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Ensure logs are unique per user for a given timestamp (optional, adjust if needed)
// LogSchema.index({ userId: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model("Log", LogSchema);
