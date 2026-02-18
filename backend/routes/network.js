import express from "express";
import { ObjectId } from "mongodb";

import { isAuthenticated } from "../middleware/auth.js";
import { getDB } from "../config/db.js";

import {
  createNetworkContact,
  findNetworkContactsByUserId,
  findNetworkContactById,
  updateNetworkContact,
  deleteNetworkContact,
  getNetworkStats,
} from "../models/Network.js";

const router = express.Router();

/**
 * Helper: validate ObjectId string
 */
const isValidObjectId = (id) =>
  ObjectId.isValid(id) && String(new ObjectId(id)) === id;

/**
 * Helper: create an activity log doc
 */
const logActivity = async ({
  userId,
  entityId,
  entityName,
  action,
  changes = null, // { field, oldValue, newValue }
  summary,
  userNote = "",
}) => {
  const db = getDB();
  await db.collection("activityLogs").insertOne({
    userId: String(userId), // ✅ keep consistent (string)
    entityType: "network",
    entityId: new ObjectId(entityId),
    entityName,
    action, // "created" | "updated" | "deleted"
    changes: changes || undefined,
    summary,
    userNote,
    timestamp: new Date(),
  });
};

/**
 * GET /api/network
 * Query params: company, name, metAt
 */
router.get("/", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);

    const { company, name, metAt } = req.query;

    const contacts = await findNetworkContactsByUserId(userId, {
      company,
      name,
      metAt,
    });

    res.json({ contacts });
  } catch (error) {
    console.error("GET /network error:", error);
    res.status(500).json({ error: "Failed to fetch network contacts" });
  }
});

/**
 * GET /api/network/stats
 */
router.get("/stats", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const stats = await getNetworkStats(userId);
    res.json(stats);
  } catch (error) {
    console.error("GET /network/stats error:", error);
    res.status(500).json({ error: "Failed to fetch network stats" });
  }
});

/**
 * GET /api/network/:id
 */
router.get("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid contact id" });
    }

    const contact = await findNetworkContactById(id, userId);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json({ contact });
  } catch (error) {
    console.error("GET /network/:id error:", error);
    res.status(500).json({ error: "Failed to fetch contact" });
  }
});

/**
 * POST /api/network
 * Body: name, email, company, role, metAt, notes, metDate, followUpDate, lastContactedDate
 */
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);

    const {
      name,
      email,
      company,
      role,
      metAt,
      notes,
      metDate,
      followUpDate,
      lastContactedDate,
    } = req.body;

    if (!name || String(name).trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Name must be at least 2 characters" });
    }

    const created = await createNetworkContact({
      userId, // ✅ string
      name,
      email,
      company,
      role,
      metAt,
      notes,
      metDate,
      followUpDate,
      lastContactedDate,
    });

    const entityName = `${created.name}${
      created.company ? ` (${created.company})` : ""
    }`;

    await logActivity({
      userId,
      entityId: created._id,
      entityName,
      action: "created",
      summary: `Added ${entityName} to network`,
      userNote: "",
    });

    res.status(201).json({ message: "Contact created", contact: created });
  } catch (error) {
    console.error("POST /network error:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

/**
 * POST /api/network/from-application
 * "Add to Network" bridge
 */
router.post("/from-application", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);

    const { name, email, company, role, notes, followUpDate, metAt } = req.body;

    if (!name || String(name).trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Name must be at least 2 characters" });
    }

    const created = await createNetworkContact({
      userId, // ✅ string
      name,
      email,
      company,
      role,
      metAt: metAt || "other",
      notes: notes || "",
      followUpDate: followUpDate || null,
      metDate: new Date(),
    });

    const entityName = `${created.name}${
      created.company ? ` (${created.company})` : ""
    }`;

    await logActivity({
      userId,
      entityId: created._id,
      entityName,
      action: "created",
      summary: `Added ${entityName} to network (from application)`,
    });

    res
      .status(201)
      .json({ message: "Contact added from application", contact: created });
  } catch (error) {
    console.error("POST /network/from-application error:", error);
    res.status(500).json({ error: "Failed to add contact from application" });
  }
});

/**
 * PUT /api/network/:id
 * Updates contact fields, auto-logs changes
 */
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid contact id" });
    }

    // Get old doc once (for logging)
    const existing = await findNetworkContactById(id, userId);
    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    // Update + get updated doc
    const updated = await updateNetworkContact(id, userId, req.body);

    // If update returned null, something is wrong with model filter/result
    if (!updated) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const fieldsToCheck = [
      "name",
      "email",
      "company",
      "role",
      "metAt",
      "notes",
      "metDate",
      "followUpDate",
      "lastContactedDate",
    ];

    const entityName = `${updated.name}${updated.company ? ` (${updated.company})` : ""}`;

    for (const field of fieldsToCheck) {
      const oldVal = existing[field];
      const newVal = updated[field];

      const oldNorm = oldVal instanceof Date ? oldVal.toISOString() : oldVal ?? null;
      const newNorm = newVal instanceof Date ? newVal.toISOString() : newVal ?? null;

      if (oldNorm !== newNorm && typeof newNorm !== "undefined") {
        await logActivity({
          userId,
          entityId: updated._id,
          entityName,
          action: "updated",
          changes: { field, oldValue: oldVal ?? null, newValue: newVal ?? null },
          summary: `Updated ${updated.name}'s ${field}`,
        });
      }
    }

    return res.json({ message: "Contact updated", contact: updated });
  } catch (error) {
    console.error("PUT /network/:id error:", error);
    return res.status(500).json({ error: "Failed to update contact" });
  }
});


/**
 * DELETE /api/network/:id
 * Deletes contact, auto-logs deletion
 */
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = String(req.session.userId);
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid contact id" });
    }

    const existing = await findNetworkContactById(id, userId);
    if (!existing) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const ok = await deleteNetworkContact(id, userId);
    if (!ok) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const entityName = `${existing.name}${
      existing.company ? ` (${existing.company})` : ""
    }`;

    await logActivity({
      userId,
      entityId: id,
      entityName,
      action: "deleted",
      summary: `Deleted ${entityName} from network`,
    });

    res.json({ message: "Contact deleted" });
  } catch (error) {
    console.error("DELETE /network/:id error:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

export default router;
