# Backend Documentation

## Project Overview

This backend is part of a web application that provides APIs for managing users, applications, and activity logs. It is built using Node.js and Express.js, with MongoDB as the database. The backend handles authentication, validation, and logging of user activities.

## Folder Structure

```
backend/
├── .env                  # Environment variables
├── eslint.config.js      # ESLint configuration
├── package.json          # Project dependencies and scripts
├── server.js             # Entry point of the application
├── config/
│   └── db.js             # Database connection setup
├── middleware/
│   └── auth.js           # Authentication middleware
├── models/
│   ├── ActivityLog.js    # Activity log schema
│   ├── Application.js    # Application schema
│   └── User.js           # User schema
├── routes/
│   ├── activityLogs.js   # Routes for activity logs
│   ├── applications.js   # Routes for applications
│   └── auth.js           # Routes for authentication
└── utils/
    ├── activityLogger.js # Utility for logging activities
    └── validation.js     # Validation utilities
```

## Routes Documentation

### Authentication Routes (`routes/auth.js`)

- **POST /auth/register**: Registers a new user.
  - **Request Body**: `{ username, password, email }`
  - **Response**: `201 Created` on success, `400 Bad Request` for validation errors.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **POST /auth/login**: Logs in a user.
  - **Request Body**: `{ username, password }`
  - **Response**: `200 OK` with a JWT token, `401 Unauthorized` for invalid credentials.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **POST /auth/logout**: Logs out a user.
  - **Response**: `200 OK` on success.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

### Application Routes (`routes/applications.js`)

- **GET /applications**: Fetches all applications.
  - **Response**: `200 OK` with a list of applications.
  - **Errors**: Throws `500 Internal Server Error` for database issues.

- **POST /applications**: Creates a new application.
  - **Request Body**: `{ name, description, owner }`
  - **Response**: `201 Created` on success, `400 Bad Request` for validation errors.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **PUT /applications/:id**: Updates an application by ID.
  - **Request Body**: `{ name, description, status }`
  - **Response**: `200 OK` on success, `404 Not Found` if the application does not exist.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **DELETE /applications/:id**: Deletes an application by ID.
  - **Response**: `200 OK` on success, `404 Not Found` if the application does not exist.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **GET /applications/:id**: Fetches a specific application by ID.
  - **Response**: `200 OK` with the application data, `404 Not Found` if the application does not exist.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **GET /applications/stats**: Fetches application statistics.
  - **Response**: `200 OK` with statistics data.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

- **GET /applications/streak**: Fetches application streaks.
  - **Response**: `200 OK` with streak data.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

### Activity Log Routes (`routes/activityLogs.js`)

- **GET /activityLogs**: Fetches all activity logs.
  - **Response**: `200 OK` with a list of activity logs.
  - **Errors**: Throws `500 Internal Server Error` for database issues.

- **POST /activityLogs**: Logs a new activity.
  - **Request Body**: `{ userId, action, timestamp }`
  - **Response**: `201 Created` on success, `400 Bad Request` for validation errors.
  - **Errors**: Throws `500 Internal Server Error` for unexpected issues.

## Features

- **User Authentication**: Secure registration and login with JWT.
- **Application Management**: CRUD operations for applications.
- **Activity Logging**: Tracks user actions and stores them in the database.
- **Validation**: Ensures data integrity using validation utilities.
- **Error Handling**: Centralized error handling for consistent API responses.

## How to Run the Project

### Prerequisites

- Node.js installed on your system.
- MongoDB installed and running locally or accessible remotely.

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend/` directory and add the following:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/your-database-name
   JWT_SECRET=your-secret-key
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. The backend will be running at `http://localhost:3000`.

### Available Scripts

- **`npm start`**: Starts the server.
- **`npm run lint`**: Runs ESLint to check for code quality issues.

## Error Handling

- All routes return appropriate HTTP status codes.
- Errors are logged to the console for debugging.
- Validation errors return `400 Bad Request`.
- Authentication errors return `401 Unauthorized`.
- Database-related issues return `500 Internal Server Error`.

---

This documentation provides a comprehensive overview of the backend folder, its features, and how to use it. For further assistance, feel free to reach out to the project maintainer.
