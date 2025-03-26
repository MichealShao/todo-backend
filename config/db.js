const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if MONGODB_URI is defined
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('Attempting to connect to MongoDB...');
    
    // 设置mongoose全局配置
    mongoose.set('strictQuery', false);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 增加到30秒
      heartbeatFrequencyMS: 2000,
      retryWrites: true,
      w: 'majority',
      maxPoolSize: 10,
      minPoolSize: 5
    });

    console.log('=== MongoDB Connection Info ===');
    console.log(`Connected to host: ${conn.connection.host}`);
    console.log(`Database name: ${conn.connection.name}`);
    console.log(`Connection state: ${mongoose.STATES[conn.connection.readyState]}`);
    console.log('==============================');

    // 监听连接事件
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });

    return conn;
  } catch (err) {
    console.error('=== MongoDB Connection Error ===');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Full error:', err);
    console.error('==============================');
    
    // Don't exit process in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Connection error in production, retrying in 5 seconds...');
      setTimeout(connectDB, 5000); // 5秒后重试
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
