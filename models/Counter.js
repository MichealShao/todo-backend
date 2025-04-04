const mongoose = require('mongoose');

// Counter模型用于跟踪各种ID的最大值
const CounterSchema = new mongoose.Schema({
  // 计数器名称（例如'task'用于任务ID）
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  // 当前计数值
  value: { 
    type: Number, 
    default: 0 
  },
  // 最后更新时间
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 获取下一个ID值并自动更新计数器
CounterSchema.statics.getNextValue = async function(counterName) {
  // 使用findOneAndUpdate原子操作来获取并更新计数器
  const counter = await this.findOneAndUpdate(
    { name: counterName },
    { $inc: { value: 1 }, updatedAt: Date.now() },
    { 
      new: true, // 返回更新后的文档
      upsert: true // 如果计数器不存在则创建
    }
  );
  
  return counter.value;
};

module.exports = mongoose.model('Counter', CounterSchema); 