import express, { Express, Request, Response } from "express";
import mongoose from "mongoose";
import cors, { CorsOptions } from "cors";

import { Habit } from "./habitSchema";
import { User } from "./routes/auth/userSchema";
import { authMiddleware } from "./routes/auth/authMiddleware";
import { compareDates, getClientDate } from "./utils";
import { config } from "./config";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
// Routes
import signupRouter from "./routes/auth/register";
import loginRouter from "./routes/auth/login";
import refreshTokenRouter from "./routes/auth/refreshToken";
import verifyTokenRouter from "./routes/auth/verifyToken";
import verifyEmailRouter from "./routes/auth/verifyEmail";

const app: Express = express();

// Middleware
app.use(helmet()); // Adds various HTTP headers for security
app.use(express.json({ limit: "10kb" })); // Body parser, limiting request size
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const allowedOrigins =
  process.env.NODE_ENV === "development"
    ? ["http://localhost:3000", "http://localhost:5174"]
    : [config.webAppOrigin];

// CORS configuration
const corsOptions: CorsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));

app.listen(config.port, () => {
  console.log("Server is running on port", config.port);
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).send("Something broke!");
  }
);

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
app.use("/", verifyEmailRouter);

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

      const habits = await Habit.find({ user: userId, isActive: true }).lean();

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

      // sort habits by priority and status (completed at the end)
      habitsWithStatus.sort((a, b) => {
        if (a.priority === b.priority) {
          return a.isCompleted ? 1 : -1;
        }
        return a.priority - b.priority;
      });

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
      await existingHabit.updateOne({ isActive: true });
      return res.status(200).json({
        message: "Habit already exists, reactivated",
        id: existingHabit._id,
      });
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
  "/habits/:userId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { habits } = req.body;

      // Create a bulk operation
      const bulkOps = habits.map(
        (habit: {
          id: string;
          priority: number | null;
          name: string | null;
        }) => ({
          updateOne: {
            filter: { _id: habit.id, user: userId },
            update: {
              $set: {
                ...(habit.priority !== null && { priority: habit.priority }),
                ...(habit.name !== null && { name: habit.name }),
              },
            },
          },
        })
      );

      // Execute the bulk operation
      const result = await Habit.bulkWrite(bulkOps);

      res.json({
        message: "Habits updated successfully",
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error updating habits:", error);
      res.status(400).json({
        message: "Error updating habits",
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
  "/habits/:habitId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { habitId } = req.params;
      // Find the habit to be deleted
      const deletedHabit = await Habit.findOne({ _id: habitId });
      if (!deletedHabit) {
        return res.status(404).json({ message: "Habit not found" });
      }

      // Delete the habit
      await deletedHabit.updateOne({ isActive: false, deletedAt: new Date() });

      // Update priorities - lower the priority of all active habits with a higher priority from the deleted habit
      await Habit.updateMany(
        {
          user: deletedHabit.user,
          priority: { $gt: deletedHabit.priority },
          isActive: true,
        },
        { $inc: { priority: -1 } }
      );

      // Respond
      res.json({
        message: "Habit deleted successfully",
        habitId: deletedHabit._id,
      });
    } catch (error) {
      console.error("Error deleting habit:", error);
      res.status(400).json({ message: "Error deleting habit", error });
    }
  }
);

export default app;
