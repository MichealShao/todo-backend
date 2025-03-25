const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('MONGO_URI =', process.env.MONGO_URI);  // 调试输出

    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('连接失败：', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
