import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcrypt";

import { User } from "./userSchema";
import { PasswordResetToken } from "./passwordResetTokenSchema";

const router = express.Router();

router.post(
  "/auth/reset-password",
  [body("token").notEmpty(), body("password").isLength({ min: 6 })],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { token, password } = req.body;

      const resetToken = await PasswordResetToken.findOne({
        token,
        expiresAt: { $gt: new Date() },
      });

      if (!resetToken) {
        return res
          .status(400)
          .json({ error: "Invalid or expired password reset token" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await User.updateOne(
        { _id: resetToken.userId },
        { $set: { password: hashedPassword } }
      );

      // Consume the token and clear any other outstanding reset tokens
      await PasswordResetToken.deleteMany({ userId: resetToken.userId });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        message: "Error resetting password",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

export default router;
