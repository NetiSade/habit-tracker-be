import { Types } from "mongoose";

type HabitInput = {
  _id: Types.ObjectId | string;
  name: string;
  completed: boolean;
  user: Types.ObjectId | string;
  // Add any other fields your Habit model has
};

export const transformHabit = (habit: HabitInput) => {
  return {
    id: habit._id.toString(),
    name: habit.name,
    completed: habit.completed,
    // Include any other fields you want in your API response
  };
};
