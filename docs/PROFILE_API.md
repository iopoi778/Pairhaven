# Profile API

This document explains the new profile/photo endpoints added to backend/routes/profile.js.

Endpoints (place files in backend/routes):
- GET /api/users/profile  - returns current user (requires Authorization: Bearer <token>)
- PUT /api/users/profile  - update profile fields and canonical photos list
- POST /api/users/photos  - upload single photo (multipart/form-data, field name `photo`)

Cloudinary helpers are in backend/services/cloudinary.js.
Signed upload helper endpoint: POST /api/uploads/sign (backend/routes/uploads.js) — returns signature, api_key and timestamp for client direct uploads.

Database schema for Postgres is in backend/db/schema.sql.

Notes:
- The new routes are added but not auto-mounted. Add to server.js:

  const profileRoutes = require('./routes/profile');
  const uploadsRoutes = require('./routes/uploads');
  const swipesRoutes = require('./routes/swipes');

  app.use('/api/users', profileRoutes);
  app.use('/api/uploads', uploadsRoutes);
  app.use('/api/swipes', swipesRoutes);

- Socket handlers helper: backend/socketHandlers.js — call it from server.js with the initialized `io`:

  const socketHandlers = require('./socketHandlers');
  socketHandlers(io);

