import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// enum for status field
export const VALID_STATUSES = [
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
];

export const createApplication = async (applicationData) => {
  const db = getDB();

  // Validation for status
  if (
    applicationData.status &&
    !VALID_STATUSES.includes(applicationData.status)
  ) {
    throw new Error(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const application = {
    userId: applicationData.userId,
    company: applicationData.company.trim(),
    role: applicationData.role.trim(),
    status: applicationData.status || "applied",
    source: applicationData.source || "other",
    dateApplied: new Date(applicationData.dateApplied),
    lastUpdated: new Date(),
    notes: applicationData.notes || "",
    salaryRange: applicationData.salaryRange || { min: null, max: null },
    contacts: applicationData.contacts || [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result = await db.collection("applications").insertOne(application);
    return { ...application, _id: result.insertedId };
  } catch (error) {
    if (error.code === 11000) {
      throw new Error(
        "Duplicate application: You already applied to this role at this company on this date",
      );
    }
    throw error;
  }
};

export const findApplicationsByUserId = async (userId, filters = {}) => {
  const db = getDB();
  const query = { userId };

  // Apply filters
  if (filters.status) query.status = filters.status;
  if (filters.company) query.company = new RegExp(filters.company, "i");
  if (filters.source) query.source = filters.source;
  if (filters.fromDate || filters.toDate) {
    query.dateApplied = {};
    if (filters.fromDate) query.dateApplied.$gte = new Date(filters.fromDate);
    if (filters.toDate) query.dateApplied.$lte = new Date(filters.toDate);
  }

  return await db
    .collection("applications")
    .find(query)
    .sort({ dateApplied: -1 })
    .toArray();
};

export const findApplicationById = async (applicationId, userId) => {
  const db = getDB();
  return await db.collection("applications").findOne({
    _id: new ObjectId(applicationId),
    userId,
  });
};

export const updateApplication = async (applicationId, userId, updateData) => {
  const db = getDB();

  // validation for status
  if (updateData.status && !VALID_STATUSES.includes(updateData.status)) {
    throw new Error(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  const update = {
    ...updateData,
    lastUpdated: new Date(),
    updatedAt: new Date(),
  };

  // Remove fields that shouldn't be updated directly
  delete update._id;
  delete update.userId;
  delete update.createdAt;

  const result = await db
    .collection("applications")
    .findOneAndUpdate(
      { _id: new ObjectId(applicationId), userId },
      { $set: update },
      { returnDocument: "after" },
    );

  return result;
};

export const deleteApplication = async (applicationId, userId) => {
  const db = getDB();
  const result = await db.collection("applications").deleteOne({
    _id: new ObjectId(applicationId),
    userId,
  });
  return result.deletedCount > 0;
};

export const getApplicationStats = async (userId) => {
  const db = getDB();

  // Total applications
  const total = await db.collection("applications").countDocuments({ userId });

  // Apps by status
  const byStatus = await db
    .collection("applications")
    .aggregate([
      { $match: { userId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();

  // Response rate by source
  const bySource = await db
    .collection("applications")
    .aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$source",
          total: { $sum: 1 },
          responded: {
            $sum: {
              $cond: [
                {
                  $in: ["$status", VALID_STATUSES],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          source: "$_id",
          total: 1,
          responded: 1,
          responseRate: {
            $cond: [
              { $eq: ["$total", 0] },
              0,
              { $multiply: [{ $divide: ["$responded", "$total"] }, 100] },
            ],
          },
        },
      },
    ])
    .toArray();

  // Average days per stage (simplified - days from applied to current status)
  const avgDays = await db
    .collection("applications")
    .aggregate([
      { $match: { userId, status: { $ne: "applied" } } },
      {
        $project: {
          status: 1,
          daysSinceApplied: {
            $divide: [
              { $subtract: ["$lastUpdated", "$dateApplied"] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$status",
          avgDays: { $avg: "$daysSinceApplied" },
        },
      },
    ])
    .toArray();

  return {
    total,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    bySource,
    avgDaysPerStage: avgDays.reduce((acc, item) => {
      acc[item._id] = Math.round(item.avgDays);
      return acc;
    }, {}),
  };
};

export const getApplicationStreak = async (userId) => {
  const db = getDB();

  // Get all application dates, sorted
  const applications = await db
    .collection("applications")
    .find({ userId })
    .sort({ dateApplied: -1 })
    .project({ dateApplied: 1 })
    .toArray();

  if (applications.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Convert to date strings (YYYY-MM-DD) and remove duplicates
  const uniqueDates = [
    ...new Set(
      applications.map((app) => app.dateApplied.toISOString().split("T")[0]),
    ),
  ]
    .sort()
    .reverse();

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 1;

  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  // Check if streak is active (applied today or yesterday)
  if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
    currentStreak = 1;

    // Count consecutive days
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const diffDays = Math.round(
        (prevDate - currDate) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 1) {
        currentStreak++;
        tempStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  tempStreak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const diffDays = Math.round((prevDate - currDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak, 1);

  return { currentStreak, longestStreak };
};
