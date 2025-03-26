// 独立的健康检查API
const mongoose = require('mongoose');

module.exports = async (req, res) => {
  try {
    console.log('Healthcheck API called');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

    // 数据库连接测试
    if (process.env.MONGODB_URI) {
      console.log('Testing direct MongoDB connection...');
      
      try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000
        });
        
        const connectionInfo = {
          status: 'success',
          database: {
            state: mongoose.STATES[mongoose.connection.readyState],
            connected: mongoose.connection.readyState === 1,
            host: mongoose.connection.host,
            name: mongoose.connection.name
          },
          environment: {
            nodeEnv: process.env.NODE_ENV,
            vercel: !!process.env.VERCEL,
            region: process.env.VERCEL_REGION || 'unknown'
          }
        };
        
        // 关闭连接
        await mongoose.connection.close();
        console.log('Connection test completed successfully');
        
        res.status(200).json(connectionInfo);
      } catch (dbError) {
        console.error('MongoDB connection test failed:');
        console.error('Error name:', dbError.name);
        console.error('Error message:', dbError.message);
        
        res.status(500).json({
          status: 'error',
          message: 'Database connection failed',
          error: {
            name: dbError.name,
            message: dbError.message,
            code: dbError.code
          },
          environment: {
            nodeEnv: process.env.NODE_ENV,
            vercel: !!process.env.VERCEL,
            region: process.env.VERCEL_REGION || 'unknown'
          }
        });
      }
    } else {
      res.status(500).json({
        status: 'error',
        message: 'MONGODB_URI not configured'
      });
    }
  } catch (error) {
    console.error('General error in healthcheck API:', error);
    res.status(500).json({
      status: 'error',
      message: 'Healthcheck failed',
      error: error.message
    });
  }
}; 