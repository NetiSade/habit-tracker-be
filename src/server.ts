import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import cors from "cors";

import { Habit } from "./habitSchema";
import { User } from "./userSchema";
import { authMiddleware } from "./authMiddleware";
import { compareDates, getClientDate } from "./utils";
import { config } from "./config";
// Routes
import signupRouter from "./routes/auth/signup";
import loginRouter from "./routes/auth/login";
import refreshTokenRouter from "./routes/auth/refreshToken";
import verifyTokenRouter from "./routes/auth/verifyToken";

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || "3000", 10);

const corsOptions = {
  //origin: ["http://localhost:19006", "exp://192.117.152.202/32"], // Add your Expo client URL
  optionsSuccessStatus: 200,
  origin: "*", // Allow all origins for development
};

app.use(cors(corsOptions));
app.use(express.json());

if (!config.mongoUri) {
  console.error("MONGODB_URI is not defined in the environment variables.");
  process.exit(1);
}

mongoose
  .connect(config.mongoUri)
  .then(() => console.log("Connected successfully to MongoDB Atlas"))
  .catch((error) => {
    console.error("Could not connect to MongoDB Atlas", error);
    process.exit(1);
  });

// Routes

// Auth routes
app.use("/", signupRouter);
app.use("/", loginRouter);
app.use("/", refreshTokenRouter);
app.use("/", verifyTokenRouter);
// Habit routes
app.get("/", (req: Request, res: Response) => {
  console.log("GET / route hit");
  res.send("Hello from the habit tracker server!");
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

      const dateQuery = req.query.date as string;
      const clientDate = getClientDate(dateQuery);

      // Validate date
      if (!clientDate) {
        return res.status(400).json({ message: "Invalid date provided" });
      }

      const habitsWithStatus = habits.map((habit) => ({
        id: habit._id,
        name: habit.name,
        isCompleted: habit.completedDates.some((date) =>
          compareDates(date.toISOString(), dateQuery)
        ),
        priority: habit.priority,
      }));

      // Sort habits by priority
      habitsWithStatus.sort((a, b) => a.priority - b.priority);

      res.json({ habits: habitsWithStatus });
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

    const habitsCount = await Habit.countDocuments({ user: userId });

    const newHabit = new Habit({
      name: name.trim(),
      priority: habitsCount + 1,
      user: userId,
    });

    const savedHabit = await newHabit.save();

    res.status(201).json({
      id: savedHabit._id,
    });
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
      const { name } = req.body;

      // Check if the habit exists and belongs to the user
      const habit = await Habit.findOne({ _id: habitId, user: userId });
      if (!habit) {
        return res
          .status(404)
          .json({ message: "Habit not found or doesn't belong to this user" });
      }

      habit.name = name;
      const updatedHabit = await habit.save();

      res.json({
        id: updatedHabit._id,
        name: updatedHabit.name,
      });
    } catch (error) {
      console.error("Error updating habit:", error);
      res.status(400).json({
        message: "Error updating habit",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

app.post(
  "/habits/:userId/:habitId/toggle",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { habitId, userId } = req.params;
      const { date, isDone } = req.body;

      // Check if the habit exists and belongs to the user
      const habit = await Habit.findOne({ _id: habitId, user: userId });
      if (!habit) {
        return res
          .status(404)
          .json({ message: "Habit not found or doesn't belong to this user" });
      }

      const dateQuery = date as string;
      const clientDate = getClientDate(dateQuery);

      // Validate date
      if (!clientDate) {
        return res.status(400).json({ message: "Invalid date provided" });
      }

      if (isDone) {
        habit.completedDates.push(date);
      } else {
        habit.completedDates = habit.completedDates.filter(
          (date) => !compareDates(date.toISOString(), dateQuery)
        );
      }

      const updatedHabit = await habit.save();

      res.json({
        id: updatedHabit._id,
      });
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

      // Update priorities - lower the priority of all habits with a higher priority from the deleted habit
      await Habit.updateMany(
        { priority: { $gt: deletedHabit.priority } },
        { $inc: { priority: -1 } }
      );

      // Respond
      res.json({
        message: "Habit deleted successfully",
        habitId: deletedHabit._id,
      });
    } catch (error) {
      res.status(400).json({ message: "Error deleting habit", error });
    }
  }
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
