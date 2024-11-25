import mongoose from "mongoose";

const habitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    priority: { type: Number, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness of habit names per user
habitSchema.index({ name: 1, user: 1 }, { unique: true });

export const Habit = mongoose.model("Habit", habitSchema);
