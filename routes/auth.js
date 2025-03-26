const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// User registration - POST /api/register
router.post('/register', async (req, res) => {
  console.log('Registration attempt:', { ...req.body, password: '[HIDDEN]' });
  
  const { username, email, password } = req.body;

  try {
    // Validate input
    if (!username || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    console.log('Checking for existing user...');
    let user = await User.findOne({ email });
    if (user) {
      console.log('User already exists:', email);
      return res.status(400).json({ msg: 'User already exists' });
    }

    console.log('Creating new user...');
    user = new User({ username, email, password });

    // Hash password
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    console.log('Saving user to database...');
    await user.save();

    console.log('Generating JWT...');
    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) {
          console.error('JWT Error:', err);
          throw err;
        }
        console.log('Registration successful');
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      msg: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// User login - POST /api/login
router.post('/login', async (req, res) => {
  console.log('Login attempt:', { ...req.body, password: '[HIDDEN]' });
  
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({ msg: 'Please enter all fields' });
    }

    console.log('Finding user...');
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    console.log('Comparing password...');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Invalid password for:', email);
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    console.log('Generating JWT...');
    const payload = { user: { id: user.id } };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) {
          console.error('JWT Error:', err);
          throw err;
        }
        console.log('Login successful for:', email);
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      msg: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
