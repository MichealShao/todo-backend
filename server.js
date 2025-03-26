// Load env variables first
require('dotenv').config();

// Log environment variables for debugging
console.log('Environment Check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const connectDB = require('./config/db');
const Task = require('./models/Task');

const app = express();

// Connect to database
connectDB();

// Enhanced CORS configuration
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['x-auth-token'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api', authRoutes);       
app.use('/api/tasks', taskRoutes);  

// Add root route handler
app.get('/', (req, res) => {
  res.json({ message: 'Todo API is running' });
});

// Add 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ message: `Route ${req.url} not found` });
});

// Function to periodically check for expired tasks
const updateExpiredTasks = async () => {
  try {
    console.log('Starting to check for expired tasks...');
    
    // Find all tasks with deadline passed but status not set to Expired
    const now = new Date();
    const tasksToUpdate = await Task.find({
      deadline: { $lt: now },
      status: { $ne: 'Expired' }
    });
    
    if (tasksToUpdate.length > 0) {
      console.log(`Scheduled check: Found ${tasksToUpdate.length} expired tasks, updating status to Expired`);
      
      // Batch update these tasks to Expired status
      const result = await Task.updateMany(
        { 
          _id: { $in: tasksToUpdate.map(t => t._id) },
          status: { $ne: 'Expired' }
        },
        { $set: { status: 'Expired' } }
      );
      
      console.log(`Updated ${result.nModified} tasks to Expired status`);
    } else {
      console.log('No tasks found that need status updates');
    }
  } catch (error) {
    console.error('Error updating expired tasks:', error);
  }
};

// Start server
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`Server started on port: ${PORT}`);
  
  // Run check immediately
  updateExpiredTasks();
  
  // Set up scheduled task to check for expired tasks every hour
  setInterval(updateExpiredTasks, 60 * 60 * 1000);
});

// Graceful server shutdown
process.on('SIGINT', () => {
  console.log('Received shutdown signal, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
