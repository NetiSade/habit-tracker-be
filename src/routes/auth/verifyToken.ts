import express from "express";
import jwt from "jsonwebtoken";

import { config } from "../../config";
import { User } from "./userSchema";

const router = express.Router();

router.get("/auth/verify-token", async (req, res) => {
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    return res
      .status(401)
      .json({ isValid: false, message: "Authorization header is missing" });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ isValid: false, message: "Invalid authorization format" });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    return res
      .status(401)
      .json({ isValid: false, message: "Token is missing" });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };

    // Optional: Check if the user still exists in the database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res
        .status(401)
        .json({ isValid: false, message: "User not found" });
    }

    // Token is valid
    return res.json({
      isValid: true,
      userId: decoded.userId,
      // You can include additional non-sensitive user info here if needed
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ isValid: false, message: "Invalid token" });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res
        .status(401)
        .json({ isValid: false, message: "Token has expired" });
    }
    console.error("Token verification error:", error);
    return res
      .status(500)
      .json({ isValid: false, message: "Internal server error" });
  }
});

export default router;
