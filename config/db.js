const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 增加到10秒
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      keepAlive: true,
      keepAliveInitialDelay: 300000
    });

    console.log('=== MongoDB Connection Info ===');
    console.log(`Connected to host: ${conn.connection.host}`);
    console.log(`Database name: ${conn.connection.name}`);
    console.log(`Connection state: ${conn.connection.readyState}`);
    console.log('==============================');
    
    // 设置mongoose全局配置
    mongoose.set('bufferCommands', false);
    
    return conn;
  } catch (err) {
    console.error('=== MongoDB Connection Error ===');
    console.error('Error message:', err.message);
    console.error('Error name:', err.name);
    console.error('Full error:', err);
    console.error('==============================');
    
    // Don't exit process in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Connection error in production, but keeping server alive');
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
