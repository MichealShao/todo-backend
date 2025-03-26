require('dotenv').config();
const mongoose = require('mongoose');

// 直接设置连接字符串用于测试
const MONGODB_URI = 'mongodb+srv://mengqiushaw:jaOfqHw4usRDWqZf@cluster0.kegbrpo.mongodb.net/todo_db?retryWrites=true&w=majority&appName=Cluster0';

console.log('=== MongoDB Connection Test ===');
console.log('Starting connection test...');
console.log('Testing with direct connection string');

async function testConnection() {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    console.log('=== Connection Successful ===');
    console.log('Connected to MongoDB Atlas');
    console.log('Host:', conn.connection.host);
    console.log('Database:', conn.connection.name);
    console.log('Connection State:', mongoose.STATES[conn.connection.readyState]);

    // 测试数据库操作
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('\n=== Database Collections ===');
    collections.forEach(collection => {
      console.log('- ' + collection.name);
    });

  } catch (error) {
    console.error('\n=== Connection Error ===');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    if (error.reason) {
      console.error('Error Reason:', error.reason);
    }
  } finally {
    // 关闭连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    console.log('\nConnection test completed');
    process.exit(0);
  }
}

testConnection(); 