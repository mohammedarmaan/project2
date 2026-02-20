import { MongoClient } from "mongodb";

let db = null;
let client = null;

export const connectDB = async () => {
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();

    // Users collection indexes
    await db.collection("users").createIndex({ email: 1 }, { unique: true });

    // Applications collection indexes
    await db
      .collection("applications")
      .createIndex(
        { userId: 1, company: 1, role: 1, dateApplied: 1 },
        { unique: true },
      );
    await db.collection("applications").createIndex({ status: 1 });
    await db.collection("applications").createIndex({ source: 1 });
    await db.collection("applications").createIndex({ dateApplied: -1 });
    await db.collection("applications").createIndex({ userId: 1 });

    // Network collection indexes
    await db.collection("network").createIndex({ userId: 1 });
    await db.collection("network").createIndex({ company: 1 });
    await db.collection("network").createIndex({ name: "text" });
    await db.collection("network").createIndex({ metAt: 1 });
    await db.collection("network").createIndex({ followUpDate: 1 });

    // ActivityLogs collection indexes
    await db
      .collection("activityLogs")
      .createIndex({ userId: 1, timestamp: -1 });
    await db
      .collection("activityLogs")
      .createIndex({ entityType: 1, timestamp: -1 });
    await db.collection("activityLogs").createIndex({ entityId: 1 });
    await db.collection("activityLogs").createIndex({ timestamp: -1 });

    console.log("MongoDB connected and indexes created");
    return db;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// export const getDB = () => {
//   if (!db) {
//     throw new Error("Database not initialized. Call connectDB first.");
//   }

//   client = new MongoClient(process.env.MONGODB_URI);
//   await client.connect();

//   db = client.db(process.env.DB_NAME); // set DB_NAME in .env (recommended)
//   await ensureIndexes(db);

//   console.log('MongoDB connected and indexes created');
//   return db;
// };

// const ensureIndexes = async (db) => {
//   await db.collection("users").createIndex({ email: 1 }, { unique: true });

//   await db
//     .collection("applications")
//     .createIndex(
//       { userId: 1, company: 1, role: 1, dateApplied: 1 },
//       { unique: true }
//     );
//   await db.collection("applications").createIndex({ status: 1 });
//   await db.collection("applications").createIndex({ source: 1 });
//   await db.collection("applications").createIndex({ dateApplied: -1 });

//   await db.collection("network").createIndex({ userId: 1 });
//   await db.collection("network").createIndex({ company: 1 });
//   await db.collection("network").createIndex({ name: "text" });
//   await db.collection("network").createIndex({ metAt: 1 });
//   await db.collection("network").createIndex({ followUpDate: 1 });

//   await db.collection("activityLogs").createIndex({ userId: 1, timestamp: -1 });
//   await db
//     .collection("activityLogs")
//     .createIndex({ entityType: 1, timestamp: -1 });
//   await db.collection("activityLogs").createIndex({ entityId: 1 });
//   await db.collection("activityLogs").createIndex({ timestamp: -1 });
// };

export const getDB = () => {
  if (!db) throw new Error("Database not initialized. Call connectDB first.");
  return db;
};

export const getClient = () => {
  if (!client)
    throw new Error("Mongo client not initialized. Call connectDB first.");
  return client;
};

export const closeDB = async () => {
  if (client) {
    await client.close();
  }
};
