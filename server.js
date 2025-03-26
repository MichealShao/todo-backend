// Load env variables first
require('dotenv').config();

// Enhanced environment variable logging
console.log('=== Environment Variables Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
console.log('MONGODB_URI first 10 chars:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 10) + '...' : 'not set');
console.log('Available env vars:', Object.keys(process.env).filter(key => !key.includes('SECRET')));
console.log('Process env location:', process.env.VERCEL ? 'Vercel' : 'Local');
console.log('================================');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Task = require('./models/Task');

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

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
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
        mongoDbUri: process.env.MONGODB_URI ? '已配置' : '未配置'
      }
    };
    res.json(connectionInfo);
  } catch (error) {
    res.status(500).json({
      message: 'Error checking database status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
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
    
    const now = new Date();
    const tasksToUpdate = await Task.find({
      deadline: { $lt: now },
      status: { $ne: 'Expired' }
    });
    
    if (tasksToUpdate.length > 0) {
      console.log(`Found ${tasksToUpdate.length} expired tasks, updating status to Expired`);
      
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

// 为保证在Vercel环境中有一个数据库连接
// 在模块作用域中直接调用连接函数
if (process.env.VERCEL) {
  console.log('In Vercel environment, connecting to database...');
  connectDB()
    .then(() => {
      console.log('Successfully connected to database in Vercel environment');
    })
    .catch(err => {
      console.error('Failed to connect to database in Vercel environment:', err);
    });
}

// 条件启动服务器（仅在非Vercel环境下）
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5001;
  
  const startServer = async () => {
    try {
      // 先连接数据库
      await connectDB();
      
      // 启动服务器
      const server = app.listen(PORT, () => {
        console.log(`Server started on port: ${PORT}`);
        
        // 运行定时任务
        updateExpiredTasks();
        setInterval(updateExpiredTasks, 60 * 60 * 1000);
      });
  
      // Graceful shutdown
      const shutdown = async () => {
        console.log('Received shutdown signal');
        
        // 关闭服务器
        server.close(() => {
          console.log('Server closed');
          
          // 关闭数据库连接
          mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
          });
        });
  
        // 如果5秒内没有正常关闭，强制退出
        setTimeout(() => {
          console.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 5000);
      };
  
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
  
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };
  
  startServer();
}

// 为Vercel导出Express应用实例
module.exports = app;
