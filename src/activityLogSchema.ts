import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    habit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true,
    },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

// Indexes for efficient querying
activityLogSchema.index({ user: 1, date: 1 }); // Query by user and date range
activityLogSchema.index({ habit: 1, date: 1 }); // Query by habit and date range

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
