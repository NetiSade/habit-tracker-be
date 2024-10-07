import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { Habit } from "./habitSchema";
import { User } from "./userSchema";
import { authMiddleware } from "./authMiddleware";
import { transformHabit } from "./utils";

dotenv.config();

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || "3000", 10);

const corsOptions = {
  //origin: ["http://localhost:19006", "exp://192.117.152.202/32"], // Add your Expo client URL
  optionsSuccessStatus: 200,
  origin: "*", // Allow all origins for development
};

app.use(cors(corsOptions));
app.use(express.json());

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("MONGODB_URI is not defined in the environment variables.");
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error("JWT_SECRET is not defined in the environment variables.");
  process.exit(1);
}

mongoose
  .connect(mongoUri)
  .then(() => console.log("Connected successfully to MongoDB Atlas"))
  .catch((error) => {
    console.error("Could not connect to MongoDB Atlas", error);
    process.exit(1);
  });

// Routes
app.get("/", (req: Request, res: Response) => {
  console.log("GET / route hit");
  res.send("Hello from the habit tracker server!");
});

app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Create new user
    const user = new User({ username, email, password });
    await user.save();

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "1d",
    });

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      message: "Error signing up",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Authentication failed" });
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret, {
      expiresIn: "1h",
    });

    res.json({ token, userId: user._id });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get(
  "/habits/:userId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Check if the user exists
      const user = await User.findById(userId);
      if (!user) {
        console.log("User not found");
        return res.status(404).json({ message: "User not found" });
      }

      const habits = await Habit.find({ user: userId }).lean();
      const transformedHabits = habits.map(transformHabit);

      res.json({ habits: transformedHabits });
    } catch (error) {
      console.error("Error fetching habits:", error);
      res.status(500).json({
        message: "Error fetching habits",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

app.post("/habits", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, userId } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ message: "Valid habit name is required" });
    }

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if this habit already exists for this user
    const existingHabit = await Habit.findOne({
      name: name.trim(),
      user: userId,
    });
    if (existingHabit) {
      return res
        .status(409)
        .json({ message: "This habit already exists for this user" });
    }

    const newHabit = new Habit({
      name: name.trim(),
      completed: false,
      user: userId,
    });

    const savedHabit = await newHabit.save();
    const transformedHabit = transformHabit(savedHabit);

    res.status(201).json(transformedHabit);
  } catch (error) {
    console.error("Error creating habit:", error);
    res.status(400).json({
      message: "Error creating habit",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.put(
  "/habits/:userId/:habitId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { habitId, userId } = req.params;
      const { name, completed } = req.body;

      // Check if the habit exists and belongs to the user
      const habit = await Habit.findOne({ _id: habitId, user: userId });
      if (!habit) {
        return res
          .status(404)
          .json({ message: "Habit not found or doesn't belong to this user" });
      }

      habit.name = name || habit.name;
      habit.completed = completed !== undefined ? completed : habit.completed;

      const updatedHabit = await habit.save();
      const transformedHabit = transformHabit(updatedHabit);

      res.json(transformedHabit);
    } catch (error) {
      console.error("Error updating habit:", error);
      res.status(400).json({
        message: "Error updating habit",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

app.delete(
  "/habits/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Delete
      const deletedHabit = await Habit.findByIdAndDelete(req.params.id).lean();
      if (!deletedHabit) {
        return res.status(404).json({ message: "Habit not found" });
      }
      // Transform
      const transformedHabit = transformHabit(deletedHabit);
      // Respond
      res.json({
        message: "Habit deleted successfully",
        habit: transformedHabit,
      });
    } catch (error) {
      res.status(400).json({ message: "Error deleting habit", error });
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
