// Load env variables first
require('dotenv').config();

// Import logger utility
const logger = require('./utils/logger');

// Environment variables check
logger.info('=== Environment Variables Check ===');
logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(`MONGODB_URI exists: ${!!process.env.MONGODB_URI}`);
logger.info(`MONGODB_URI first 10 chars: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 10) + '...' : 'not set'}`);
logger.info(`Available env vars: ${Object.keys(process.env).filter(key => !key.includes('SECRET'))}`);
logger.info(`Process env location: ${process.env.VERCEL ? 'Vercel' : 'Local'}`);
logger.info('================================');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Task = require('./models/Task');
const taskUtils = require('./utils/taskUtils');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: ['https://todo-frontend-nine-khaki.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['x-auth-token'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

app.use('/api', authRoutes);       
app.use('/api/tasks', taskRoutes);  

// Add root route handler
app.get('/', async (req, res) => {
  try {
    const dbState = mongoose.STATES[mongoose.connection.readyState];
    const connectionInfo = {
      message: 'Todo API is running',
      database: {
        state: dbState,
        connected: mongoose.connection.readyState === 1,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        models: Object.keys(mongoose.models)
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        mongoDbUri: process.env.MONGODB_URI ? 'Configured' : 'Not configured'
      }
    };
    res.json(connectionInfo);
  } catch (error) {
    logger.error('Error checking database status', error);
    res.status(500).json({
      message: 'Error checking database status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Add 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Route ${req.url} not found` });
});

// Global error handler
app.use(errorHandler);

// Function to periodically check for expired tasks
const updateExpiredTasks = async () => {
  try {
    logger.info('Starting to check for expired tasks...');
    
    // Get today's date without time component
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const tasksToUpdate = await Task.find({
      deadline: { $lt: todayDate },
      status: { $ne: 'Expired' }
    });
    
    if (tasksToUpdate.length > 0) {
      logger.info(`Found ${tasksToUpdate.length} expired tasks, updating status to Expired`);
      
      const result = await Task.updateMany(
        { 
          _id: { $in: tasksToUpdate.map(t => t._id) },
          status: { $ne: 'Expired' }
        },
        { $set: { status: 'Expired' } }
      );
      
      logger.info(`Updated ${result.nModified || result.modifiedCount || 0} tasks to Expired status`);
    } else {
      logger.info('No tasks found that need status updates');
    }
  } catch (error) {
    logger.error('Error updating expired tasks', error);
  }
};

// Ensure database connection in Vercel environment
// Direct connection in module scope for Vercel
if (process.env.VERCEL) {
  logger.info('In Vercel environment, connecting to database...');
  connectDB()
    .then(() => {
      logger.info('Successfully connected to database in Vercel environment');
    })
    .catch(err => {
      logger.error('Failed to connect to database in Vercel environment', err);
    });
}

// Conditional server startup (only in non-Vercel environment)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5001;
  
  const startServer = async () => {
    try {
      // Connect to database first
      await connectDB();
      
      // Start server
      const server = app.listen(PORT, () => {
        logger.info(`Server started on port: ${PORT}`);
        
        // Run scheduled tasks
        updateExpiredTasks();
        setInterval(updateExpiredTasks, 60 * 60 * 1000); // Run every hour
      });
  
      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Received shutdown signal');
        
        // Close server
        server.close(() => {
          logger.info('Server closed');
          
          // Close database connection
          mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
          });
        });
  
        // Force exit if not closed within 5 seconds
        setTimeout(() => {
          logger.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 5000);
      };
  
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
  
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  };
  
  startServer();
}

// Export Express app instance for Vercel
module.exports = app;
