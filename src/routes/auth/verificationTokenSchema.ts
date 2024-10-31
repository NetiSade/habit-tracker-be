import mongoose from "mongoose";

const verificationTokenSchema = new mongoose.Schema({
  token: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const VerificationToken = mongoose.model(
  "VerificationToken",
  verificationTokenSchema
);
