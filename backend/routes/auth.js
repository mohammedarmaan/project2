import express from "express";
import { ObjectId } from "mongodb";
import {
  createUser,
  findUserByEmail,
  findUserById,
  comparePassword,
} from "../models/User.js";
import {
  validateEmail,
  validatePassword,
  validateName,
} from "../utils/validation.js";
import { isAuthenticated } from "../middleware/auth.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!validateName(name)) {
      return res.status(400).json({ error: "Name must be at least 2 characters" });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const user = await createUser({ email, password, name });

    req.session.userId = user._id.toString();
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Session save failed" });
      res.status(201).json({
        message: "Registration successful",
        user: { id: user._id, email: user.email, name: user.name },
      });
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.userId = user._id.toString();
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: "Session save failed" });
      res.json({
        message: "Login successful",
        user: { id: user._id, email: user.email, name: user.name },
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logout successful" });
  });
});

// Get current user
router.get("/me", isAuthenticated, async (req, res) => {
  try {
    const user = await findUserById(new ObjectId(req.session.userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

export default router;
