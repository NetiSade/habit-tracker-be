import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { User } from "./userSchema";
import { config } from "../../config";
import { Resend } from "resend";
import { VerificationToken } from "./verificationTokenSchema";

const router = express.Router();

const resend = new Resend(config.resendApiKey);

const sendVerificationEmail = async (
  email: string,
  verificationToken: string
) => {
  const verificationLink = `${config.emailVerificationUrl}?token=${verificationToken}`;

  try {
    const res = await resend.emails.send({
      from: "onboarding@resend.dev", // or your verified domain
      to: email,
      subject: "Habit Tracker - Verify Your Email Address 📧",
      html: `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationLink}">Verify Email</a>
        <p><strong>Note:</strong> The link will expire in 24 hours.</p>
      `,
    });

    return res;
  } catch (error) {
    throw new Error("Failed to send verification email");
  }
};

const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

router.post(
  "/auth/register",
  [
    body("username").trim().isLength({ min: 3 }).escape(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
  ],
  async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });

      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const user = new User({
        username,
        email,
        password: hashedPassword,
        isVerified: false,
      });

      await user.save();

      // Generate verification token
      const verificationToken = generateVerificationToken();

      // Save verification token
      await VerificationToken.create({
        userId: user._id,
        token: verificationToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Send verification email
      await sendVerificationEmail(email, verificationToken);

      res.status(201).json({
        userId: user._id,
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } catch (error) {
      console.error("~ file: register.ts:102 ~ error:", error);
      res.status(500).json({
        message: "Error signing up",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

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
