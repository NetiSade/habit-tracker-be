import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { User } from "../../userSchema";
import { config } from "../../config";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign({ userId: user._id }, config.jwtSecret, {
      expiresIn: "15m",
    });

    const refreshToken = jwt.sign(
      { userId: user._id },
      config.refreshTokenSecret,
      { expiresIn: "7d" }
    );

    res.json({ accessToken, refreshToken, userId: user._id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;