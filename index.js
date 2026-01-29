/**
 * Sky High International - Customer Inquiry Management System
 * Backend API Server (Modular Version)
 *
 * @author Samie
 * @company Sky High International Co., Ltd.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const inquiryRoutes = require('./routes/inquiries');
const materialRoutes = require('./routes/materials');
const assigneeRoutes = require('./routes/assignees');
const countryRoutes = require('./routes/countries');
const masterRoutes = require('./routes/master');
const dashboardRoutes = require('./routes/dashboard');
const attachmentRoutes = require('./routes/attachments');
const notificationRoutes = require('./routes/notifications');

// Import middleware
const { authenticateToken } = require('./middleware/auth');

// Import database
const { pool } = require('./config/db');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow serving files cross-origin
}));

// CORS configuration - supports multiple origins for Vercel deployments
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CORS_ORIGIN,
].filter(Boolean);                                                                                                                                            
                                                                                                                                                                 
  app.use(cors({                                                                                                                                                 
    origin: (origin, callback) => {                                                                                                                              
      // Allow requests with no origin (mobile apps, Postman, etc.)                                                                                              
      if (!origin) return callback(null, true);                                                                                                                  
                                                                                                                                                                 
      // Check if origin matches allowed list or is a Vercel preview deployment                                                                                  
      if (                                                                                                                                                       
        allowedOrigins.includes(origin) ||                                                                                                                       
        origin.includes('vercel.app') ||                                                                                                                         
        origin.includes('railway.app')                                                                                                                           
      ) {                                                                                                                                                        
        return callback(null, true);                                                                                                                             
      }                                                                                                                                                          
                                                                                                                                                                 
      callback(new Error('Not allowed by CORS'));                                                                                                                
    },                                                                                                                                                           
    credentials: true,                                                                                                                                           
  }));        

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Sky High International API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/assignees', assigneeRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api', masterRoutes); // /api/tasks, /api/categories, etc.
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/notifications', authenticateToken, notificationRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
====================================================
  Sky High International
  Customer Inquiry Management System API
====================================================
  Server running on: http://localhost:${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}

  API Endpoints:
  - GET  /api/health
  - POST /api/auth/login
  - GET  /api/customers
  - GET  /api/inquiries
  - POST /api/inquiries
  - GET  /api/materials
  - GET  /api/assignees
  - GET  /api/tasks
  - GET  /api/categories
  - GET  /api/dashboard/stats
  - POST /api/attachments/header/:id
  - POST /api/attachments/detail/:id
  - GET  /api/attachments/:id/download
====================================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

module.exports = app;
