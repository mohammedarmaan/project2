import { getDB } from '../config/db.js';
import { ObjectId } from 'mongodb';

export const createActivityLog = async (logData) => {
  const db = getDB();
  
  const log = {
    userId: logData.userId,
    entityType: logData.entityType, // "application" | "network"
    entityId: new ObjectId(logData.entityId),
    entityName: logData.entityName,
    action: logData.action, // "created" | "updated" | "deleted"
    changes: logData.changes || null,
    summary: logData.summary,
    userNote: logData.userNote || '',
    timestamp: new Date()
  };
  
  const result = await db.collection('activityLogs').insertOne(log);
  return { ...log, _id: result.insertedId };
};

export const findActivityLogsByEntityType = async (userId, entityType) => {
  const db = getDB();
  return await db.collection('activityLogs')
    .find({ userId, entityType })
    .sort({ timestamp: -1 })
    .toArray();
};

export const findActivityLogsByEntityId = async (entityId) => {
  const db = getDB();
  return await db.collection('activityLogs')
    .find({ entityId: new ObjectId(entityId) })
    .sort({ timestamp: -1 })
    .toArray();
};

export const updateActivityLogNote = async (logId, userId, userNote) => {
  const db = getDB();
  const result = await db.collection('activityLogs').findOneAndUpdate(
    { _id: new ObjectId(logId), userId },
    { $set: { userNote } },
    { returnDocument: 'after' }
  );
  return result;
};

export const findAllActivityLogs = async (userId, limit = 50) => {
  const db = getDB();
  return await db.collection('activityLogs')
    .find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
};