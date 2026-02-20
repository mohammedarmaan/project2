import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import cors from "cors";

import { connectDB, getClient } from "./config/db.js";

import authRoutes from "./routes/auth.js";
import applicationRoutes from "./routes/applications.js";
import activityLogRoutes from "./routes/activityLogs.js";
import networkRoutes from "./routes/network.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const startServer = async () => {
  try {
    await connectDB();

    app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          client: getClient(),
          collectionName: "sessions",
          ttl: 24 * 60 * 60,
        }),
        cookie: {
          maxAge: 24 * 60 * 60 * 1000,
          httpOnly: true,
          secure: true,
          sameSite: "none",
          // secure: process.env.NODE_ENV === "production",
          // sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          //hardcoding instead coz its not working idk why
        },
      }),
    );

    app.use("/api/auth", authRoutes);
    app.use("/api/applications", applicationRoutes);
    app.use("/api/activity-logs", activityLogRoutes);
    app.use("/api/network", networkRoutes);

    app.get("/health", (req, res) => res.json({ status: "ok" }));

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
