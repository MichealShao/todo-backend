const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('MongoDB URI =', process.env.MONGODB_URI);  // Debug output

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Connection failed:', err.message);
    // Log more details about the error
    console.error('Error details:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
