// Load environment variables first
require('dotenv').config();
console.log('DEBUG: R2 BUCKET from server.js:', process.env.R2_BUCKET_NAME);
const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const multer    = require('multer');
const admin     = require('firebase-admin');

const app       = express();
const HOST      = '0.0.0.0';
const PORT      = process.env.PORT || 5000;

// Only use multer memory storage here for any manual uploads (rarely needed)
const upload    = multer({ storage: multer.memoryStorage() });

// Firebase Admin initialization (unchanged)
try {
  let firebaseConfig;
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log('Using Firebase environment variables');
    firebaseConfig = {
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      projectId: process.env.FIREBASE_PROJECT_ID
    };
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    console.log('Using service account file from env variable:', serviceAccountPath);
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found at: ${serviceAccountPath}`);
    }
    const serviceAccount = require(serviceAccountPath);
    console.log('Service account loaded, project_id:', serviceAccount.project_id);
    firebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    };
  } else {
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account-key.json');
    console.log('Using default service account path:', serviceAccountPath);
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Neither environment variables nor service account file found for Firebase');
    }
    const serviceAccount = require('./firebase-service-account-key.json');
    console.log('Service account loaded, project_id:', serviceAccount.project_id);
    firebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    };
  }
  admin.initializeApp(firebaseConfig);
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.error('Firebase Admin initialization failed:', error.message);
  console.error('Firebase will not be available for authentication');
}

// Middlewares
app.use(express.json());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Static files
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Import routes - FIXED: Removed duplicate notificationRoutes import
const postRoutes         = require('./routes/posts');
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const groupRoutes        = require('./routes/groups');
const notificationRoutes = require('./routes/notifications');
const groupMessages      = require('./routes/groupMessages');

// Mount routes - FIXED: Removed duplicate groupRoutes mounting
app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check, root, and error handlers
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'initialized' : 'not initialized'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'SpamIt API Server',
    status: 'running',
    endpoints: ['/api/auth', '/api/posts', '/api/users', '/api/groups', '/api/notifications']
  });
});

// 404 and error handling
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, error: `Cannot ${req.method} ${req.originalUrl}` });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Database connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

mongoose.connect(DATABASE_URL)
.then(() => {
  console.log('Connected to MongoDB');
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]) {
        const address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    if (addresses.length > 0) {
      console.log(`Network access: <http://${addresses>[0]}:${PORT}`);
      console.log(`Android emulator: http://10.0.2.2:${PORT}`);
    }
  });
})
.catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
