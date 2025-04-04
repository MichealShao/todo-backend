const mongoose = require('mongoose');

// Counter model for tracking various ID sequences
const CounterSchema = new mongoose.Schema({
  // Counter name (e.g., 'task' for task IDs)
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  // Current counter value
  value: { 
    type: Number, 
    default: 0 
  },
  // Last update timestamp
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Get next ID value and automatically update counter
CounterSchema.statics.getNextValue = async function(counterName) {
  // Use findOneAndUpdate atomic operation to get and update counter
  const counter = await this.findOneAndUpdate(
    { name: counterName },
    { $inc: { value: 1 }, updatedAt: Date.now() },
    { 
      new: true, // Return updated document
      upsert: true // Create counter if it doesn't exist
    }
  );
  
  return counter.value;
};

module.exports = mongoose.model('Counter', CounterSchema); 