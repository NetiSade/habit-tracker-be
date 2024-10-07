import mongoose from "mongoose";

const habitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    completed: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness of habit names per user
habitSchema.index({ name: 1, user: 1 }, { unique: true });

export const Habit = mongoose.model("Habit", habitSchema);
