require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const connectDB = require('./config/db');

const app = express();

// 连接数据库
connectDB();

// 中间件
app.use(express.json());
app.use(cors());

// 路由
app.use('/api', authRoutes);        // ✅ 使用已引入的模块
app.use('/api/tasks', taskRoutes);  // ✅ 也是一样

// 启动服务器
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
