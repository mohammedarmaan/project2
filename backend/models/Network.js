import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

// enum for metAt field
export const VALID_MET_AT = [
  "linkedin",
  "career_fair",
  "meetup",
  "referral",
  "cold_outreach",
  "other",
];

const buildUserIdMatch = (userId) => {
  const userIdStr = String(userId);

  // Match both types just in case some docs were stored as ObjectId earlier
  const candidates = [userIdStr];
  if (ObjectId.isValid(userIdStr)) candidates.push(new ObjectId(userIdStr));

  return { $in: candidates };
};

export const createNetworkContact = async (contactData) => {
  const db = getDB();

  if (contactData.metAt && !VALID_MET_AT.includes(contactData.metAt)) {
    throw new Error(
      `Invalid metAt. Must be one of: ${VALID_MET_AT.join(", ")}`,
    );
  }

  const contact = {
    userId: String(contactData.userId), // ✅ store as string consistently
    name: String(contactData.name).trim(),
    email: (contactData.email || "").trim().toLowerCase(),
    company: (contactData.company || "").trim(),
    role: (contactData.role || "").trim(),
    metAt: contactData.metAt || "other",
    metDate: contactData.metDate ? new Date(contactData.metDate) : new Date(),
    notes: contactData.notes || "",
    followUpDate: contactData.followUpDate
      ? new Date(contactData.followUpDate)
      : null,
    lastContactedDate: contactData.lastContactedDate
      ? new Date(contactData.lastContactedDate)
      : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (Number.isNaN(contact.metDate.getTime()))
    throw new Error("Invalid metDate");
  if (contact.followUpDate && Number.isNaN(contact.followUpDate.getTime()))
    throw new Error("Invalid followUpDate");
  if (
    contact.lastContactedDate &&
    Number.isNaN(contact.lastContactedDate.getTime())
  )
    throw new Error("Invalid lastContactedDate");

  const result = await db.collection("network").insertOne(contact);
  return { ...contact, _id: result.insertedId };
};

export const findNetworkContactsByUserId = async (userId, filters = {}) => {
  const db = getDB();

  const query = { userId: buildUserIdMatch(userId) };

  if (filters.company) query.company = new RegExp(filters.company, "i");
  if (filters.name) query.name = new RegExp(filters.name, "i");
  if (filters.metAt) query.metAt = filters.metAt;

  return await db
    .collection("network")
    .find(query)
    .sort({ updatedAt: -1 })
    .toArray();
};

export const findNetworkContactById = async (contactId, userId) => {
  const db = getDB();

  return await db.collection("network").findOne({
    _id: new ObjectId(contactId),
    userId: buildUserIdMatch(userId),
  });
};

export const updateNetworkContact = async (contactId, userId, updateData) => {
  const db = getDB();

  if (updateData.metAt && !VALID_MET_AT.includes(updateData.metAt)) {
    throw new Error(
      `Invalid metAt. Must be one of: ${VALID_MET_AT.join(", ")}`,
    );
  }

  const userIdStr = String(userId);
  const userIdMatch = buildUserIdMatch(userIdStr);

  const update = { ...updateData, updatedAt: new Date() };

  // Normalize strings
  if (update.name) update.name = String(update.name).trim();
  if (update.email) update.email = String(update.email).trim().toLowerCase();
  if (update.company) update.company = String(update.company).trim();
  if (update.role) update.role = String(update.role).trim();

  // Normalize dates
  if (update.metDate) update.metDate = new Date(update.metDate);
  if (update.followUpDate) update.followUpDate = new Date(update.followUpDate);
  if (update.lastContactedDate)
    update.lastContactedDate = new Date(update.lastContactedDate);

  // Validate dates
  if (update.metDate && Number.isNaN(update.metDate.getTime()))
    throw new Error("Invalid metDate");
  if (update.followUpDate && Number.isNaN(update.followUpDate.getTime()))
    throw new Error("Invalid followUpDate");
  if (
    update.lastContactedDate &&
    Number.isNaN(update.lastContactedDate.getTime())
  )
    throw new Error("Invalid lastContactedDate");

  // Disallow protected fields
  delete update._id;
  delete update.userId;
  delete update.createdAt;

  // 1) Update
  const updateResult = await db
    .collection("network")
    .updateOne(
      { _id: new ObjectId(contactId), userId: userIdMatch },
      { $set: update },
    );

  if (updateResult.matchedCount === 0) {
    return null; // not found / not owned
  }

  // 2) Fetch updated doc
  return await db.collection("network").findOne({
    _id: new ObjectId(contactId),
    userId: userIdMatch,
  });
};

export const deleteNetworkContact = async (contactId, userId) => {
  const db = getDB();

  const result = await db.collection("network").deleteOne({
    _id: new ObjectId(contactId),
    userId: buildUserIdMatch(userId),
  });

  return result.deletedCount > 0;
};

export const getNetworkStats = async (userId) => {
  const db = getDB();

  const userMatch = buildUserIdMatch(userId);

  const total = await db
    .collection("network")
    .countDocuments({ userId: userMatch });

  const byCompanyAgg = await db
    .collection("network")
    .aggregate([
      { $match: { userId: userMatch } },
      { $group: { _id: "$company", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  const byMetAtAgg = await db
    .collection("network")
    .aggregate([
      { $match: { userId: userMatch } },
      { $group: { _id: "$metAt", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  return {
    total,
    byCompany: byCompanyAgg.reduce((acc, item) => {
      acc[item._id || "unknown"] = item.count;
      return acc;
    }, {}),
    byMetAt: byMetAtAgg.reduce((acc, item) => {
      acc[item._id || "other"] = item.count;
      return acc;
    }, {}),
  };
};
