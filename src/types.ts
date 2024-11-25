// types/activityLog.d.ts
import { Document, ObjectId } from "mongoose";

export interface IActivityLog extends Document {
  _id: ObjectId;
  user: ObjectId;
  habit: ObjectId;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
