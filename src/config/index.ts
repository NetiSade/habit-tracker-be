import dotenv from "dotenv";

dotenv.config();

export const config = {
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
  refreshTokenSecret:
    process.env.REFRESH_TOKEN_SECRET || "your_refresh_token_secret",
  mongoUri: process.env.MONGODB_URI || "your_mongodb_uri",
  resendApiKey: process.env.RESEND_API_KEY || "your_resend api_key",
  emailVerificationUrl:
    process.env.EMAIL_VERIFICATION_URL || "http://localhost:3000/verify-email",
  webAppOrigin: process.env.WEB_APP_ORIGIN || "http://localhost:3000",
  port: process.env.PORT || 3000,
  // Add other configuration variables as needed
};
