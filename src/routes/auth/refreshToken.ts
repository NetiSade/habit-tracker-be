import express from "express";
import jwt from "jsonwebtoken";

import { config } from "../../config";

const router = express.Router();

router.post("/auth/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh Token is required" });
  }

  try {
    const payload = jwt.verify(refreshToken, config.refreshTokenSecret) as {
      userId: string;
    };

    const accessToken = jwt.sign({ userId: payload.userId }, config.jwtSecret, {
      expiresIn: "15m",
    });

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({ message: "Invalid Refresh Token" });
  }
});

export default router;
