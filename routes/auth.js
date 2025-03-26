const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// User registration - POST /api/register
router.post('/register', async (req, res) => {
  console.log('Registration attempt started');
  
  try {
    const { username, email, password } = req.body;

    // 基本验证
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    // 检查用户是否存在
    console.log('Checking for existing user...');
    const existingUser = await User.findOne({ email }).select('email');
    
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 创建新用户
    console.log('Creating new user object...');
    const newUser = new User({ username, email });
    newUser.password = newUser.hashPassword(password);

    // 保存用户
    console.log('Saving user to database...');
    const savedUser = await newUser.save();
    console.log('User saved successfully');

    // 生成token
    console.log('Generating token...');
    const token = jwt.sign(
      { user: { id: savedUser.id } },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    console.log('Registration completed successfully');
    return res.status(201).json({ token });

  } catch (err) {
    console.error('Registration error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });

    // MongoDB 重复键错误
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 其他错误
    return res.status(500).json({
      msg: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// User login - POST /api/login
router.post('/login', async (req, res) => {
  console.log('Login attempt started');
  
  try {
    const { email, password } = req.body;

    // 基本验证
    if (!email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    // 查找用户
    console.log('Finding user...');
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('User not found');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // 验证密码
    console.log('Verifying password...');
    if (!user.validatePassword(password)) {
      console.log('Invalid password');
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // 生成token
    console.log('Generating token...');
    const token = jwt.sign(
      { user: { id: user.id } },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    console.log('Login successful');
    return res.json({ token });

  } catch (err) {
    console.error('Login error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });

    return res.status(500).json({
      msg: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

module.exports = router;
