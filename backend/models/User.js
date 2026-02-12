import bcrypt from 'bcrypt';
import { getDB } from '../config/db.js';

export const createUser = async (userData) => {
  const db = getDB();
  const { email, password, name } = userData;
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const user = {
    email: email.toLowerCase(),
    password: hashedPassword,
    name: name.trim(),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const result = await db.collection('users').insertOne(user);
  if (!result.insertedId) {
      throw new Error('Failed to insert user - no insertedId returned');
    }
  return { ...user, _id: result.insertedId };
};

export const findUserByEmail = async (email) => {
  const db = getDB();
  return await db.collection('users').findOne({ email: email.toLowerCase() });
};

export const findUserById = async (userId) => {
  const db = getDB();
  return await db.collection('users').findOne({ _id: userId });
};

export const comparePassword = async (candidatePassword, hashedPassword) => {
  return await bcrypt.compare(candidatePassword, hashedPassword);
};