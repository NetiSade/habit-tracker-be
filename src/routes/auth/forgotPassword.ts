import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import crypto from "crypto";
import { Resend } from "resend";

import { User } from "./userSchema";
import { PasswordResetToken } from "./passwordResetTokenSchema";
import { config } from "../../config";

const router = express.Router();

const resend = new Resend(config.resendApiKey);

const sendPasswordResetEmail = async (email: string, resetToken: string) => {
  const resetLink = `${config.passwordResetUrl}?token=${resetToken}`;

  try {
    const res = await resend.emails.send({
      from: "onboarding@resend.dev", // same sender as the verification email
      to: email,
      subject: "Habit Tracker - Reset Your Password 🔑",
      html: `
        <h1>Password Reset</h1>
        <p>We received a request to reset the password for your account.</p>
        <p>Please click the link below to choose a new password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p><strong>Note:</strong> The link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
      `,
    });

    return res;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
};

router.post(
  "/auth/forgot-password",
  [body("email").isEmail().normalizeEmail()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email } = req.body;

      const user = await User.findOne({ email });

      // Respond identically whether or not the email is registered,
      // so the endpoint can't be used to probe for existing accounts.
      if (!user) {
        return res.json({
          message:
            "If an account with that email exists, a password reset link is on its way.",
        });
      }

      // Invalidate any previous reset tokens for this user
      await PasswordResetToken.deleteMany({ userId: user._id });

      const resetToken = crypto.randomBytes(32).toString("hex");

      await PasswordResetToken.create({
        userId: user._id,
        token: resetToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });

      await sendPasswordResetEmail(email, resetToken);

      res.json({
        message:
          "If an account with that email exists, a password reset link is on its way.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        message: "Error processing password reset request",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;
