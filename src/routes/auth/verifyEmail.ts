import express from "express";

import { User } from "./userSchema";
import { VerificationToken } from "./verificationTokenSchema";

const router = express.Router();

router.post("/auth/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    // Find verification token
    const verificationToken = await VerificationToken.findOne({
      token,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationToken) {
      return res
        .status(400)
        .json({ error: "Invalid or expired verification token" });
    }

    // Update user verification status
    await User.updateOne(
      { _id: verificationToken.userId },
      { $set: { isVerified: true } }
    );

    // Delete used token
    await VerificationToken.deleteOne({ _id: verificationToken._id });

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(500).json({ error: "Email verification failed" });
  }
});

export default router;
