const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI exists:', !!process.env.MONGODB_URI);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 超时时间5秒
      socketTimeoutMS: 45000, // 45秒后超时
      connectTimeoutMS: 10000, // 连接超时10秒
      keepAlive: true,
      keepAliveInitialDelay: 300000
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);
    
    // 设置mongoose全局配置
    mongoose.set('bufferCommands', false);
    
    return conn;
  } catch (err) {
    console.error('MongoDB connection failed:');
    console.error('Error message:', err.message);
    console.error('Error details:', err);
    // Don't exit process in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Connection error in production, but keeping server alive');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
