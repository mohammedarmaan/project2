import express from "express";
import {
  createApplication,
  findApplicationsByUserId,
  findApplicationById,
  updateApplication,
  deleteApplication,
  getApplicationStats,
  getApplicationStreak,
} from "../models/Application.js";
import { isAuthenticated } from "../middleware/auth.js";
import {
  logApplicationCreated,
  logApplicationUpdated,
  logApplicationDeleted,
} from "../utils/activityLogger.js";

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Get stats (must be before /:id route)
router.get("/stats", async (req, res) => {
  try {
    const stats = await getApplicationStats(req.session.userId);
    res.json({ stats });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Get streak (must be before /:id route)
router.get("/streak", async (req, res) => {
  try {
    const streak = await getApplicationStreak(req.session.userId);
    res.json(streak);
  } catch (error) {
    console.error("Get streak error:", error);
    res.status(500).json({ error: "Failed to fetch streak" });
  }
});

// Get all applications with optional filters
router.get("/", async (req, res) => {
  try {
    const { status, company, source, fromDate, toDate } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (company) filters.company = company;
    if (source) filters.source = source;
    if (fromDate) filters.fromDate = fromDate;
    if (toDate) filters.toDate = toDate;

    const applications = await findApplicationsByUserId(
      req.session.userId,
      filters,
    );
    res.json({ applications });
  } catch (error) {
    console.error("Get applications error:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// Get single application
router.get("/:id", async (req, res) => {
  try {
    const application = await findApplicationById(
      req.params.id,
      req.session.userId,
    );

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json({ application });
  } catch (error) {
    console.error("Get application error:", error);
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

// Create application
router.post("/", async (req, res) => {
  try {
    const {
      company,
      role,
      status,
      source,
      dateApplied,
      notes,
      salaryRange,
      contacts,
    } = req.body;

    // Check for duplicate application
    if (!company || !role || !dateApplied) {
      return res.status(400).json({
        error: "Company, role, and dateApplied are required",
      });
    }

    

    const application = await createApplication({
      userId: req.session.userId,
      company,
      role,
      status,
      source,
      dateApplied,
      notes,
      salaryRange,
      contacts,
    });

    // Log the activity
    await logApplicationCreated(req.session.userId, application);

    res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (error) {
    console.error("Create application error:", error);

    if (error.message.includes("Duplicate application")) {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to create application" });
  }
});

// Update application
router.put("/:id", async (req, res) => {
  try {
    // Get old data first
    const oldApplication = await findApplicationById(
      req.params.id,
      req.session.userId,
    );

    if (!oldApplication) {
      return res.status(404).json({ error: "Application not found" });
    }

    const allowedUpdates = [
      "company",
      "role",
      "status",
      "source",
      "dateApplied",
      "notes",
      "salaryRange",
      "contacts",
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const application = await updateApplication(
      req.params.id,
      req.session.userId,
      updates,
    );

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Log the activity
    const entityName = `${application.company} - ${application.role}`;
    await logApplicationUpdated(
      req.session.userId,
      req.params.id,
      entityName,
      oldApplication,
      application,
    );

    res.json({
      message: "Application updated successfully",
      application,
    });
  } catch (error) {
    console.error("Update application error:", error);
    
     if (error.message.includes('Invalid status')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to update application" });
  }
});

// Delete application
router.delete("/:id", async (req, res) => {
  try {
    // Get application data before deleting for logging
    const application = await findApplicationById(
      req.params.id,
      req.session.userId,
    );

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const deleted = await deleteApplication(req.params.id, req.session.userId);

    if (!deleted) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Log the activity
    const entityName = `${application.company} - ${application.role}`;
    await logApplicationDeleted(req.session.userId, req.params.id, entityName);

    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Delete application error:", error);
    res.status(500).json({ error: "Failed to delete application" });
  }
});

export default router;
