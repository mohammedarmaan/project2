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

// CORS configuration for frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5500",
    credentials: true,
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      ttl: 24 * 60 * 60,
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  }),
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/activity-logs", activityLogRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Start server
const startServer = async () => {
  try {
    // 1) Connect DB FIRST (initializes MongoClient)
    await connectDB();

    // 2) Now the client exists, so session store can reuse it
    app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          client: getClient(),
          dbName: process.env.DB_NAME,
          collectionName: "sessions",
          ttl: 24 * 60 * 60,
        }),
        cookie: {
          maxAge: 24 * 60 * 60 * 1000,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        },
      }),
    );

    // 3) Routes AFTER session middleware (so req.session is available)
    app.use("/api/auth", authRoutes);
    app.use("/api/applications", applicationRoutes);
    app.use("/api/activity-logs", activityLogRoutes);
    app.use("/api/network", networkRoutes);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
