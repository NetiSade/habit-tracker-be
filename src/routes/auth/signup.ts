import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { User } from "../../userSchema";
import { config } from "../../config";

const router = express.Router();

router.post(
  "/signup",
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

      // Basic validation
      if (!username || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }

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
      });

      await user.save();

      // Generate tokens
      const accessToken = jwt.sign({ userId: user._id }, config.jwtSecret, {
        expiresIn: "15m",
      });

      const refreshToken = jwt.sign(
        { userId: user._id },
        config.refreshTokenSecret,
        {
          expiresIn: "7d",
        }
      );

      // Send response
      res.status(201).json({
        message: "User created successfully",
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({
        message: "Error signing up",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;
