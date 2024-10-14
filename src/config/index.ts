import dotenv from "dotenv";

dotenv.config();

export const config = {
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
  refreshTokenSecret:
    process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret",
  mongoUri: process.env.MONGODB_URI || "your_mongodb_uri",
  // Add other configuration variables as needed
};
