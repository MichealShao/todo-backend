// 任务ID迁移脚本
require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Counter = require('../models/Counter');

async function migrateTaskIds() {
  try {
    // 连接到MongoDB
    console.log('正在连接到数据库...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('数据库连接成功');

    // 获取所有任务并按创建时间排序
    const tasks = await Task.find({}).sort({ createdAt: 1 });
    console.log(`找到 ${tasks.length} 个任务需要迁移`);

    // 重置任务ID计数器
    await Counter.findOneAndUpdate(
      { name: 'task' },
      { value: 0 },
      { upsert: true }
    );

    // 为每个任务分配ID
    let counter = 0;
    for (const task of tasks) {
      counter++;
      // 如果任务已有ID，则跳过
      if (task.taskId) {
        console.log(`任务 ${task._id} 已有ID ${task.taskId}，跳过`);
        // 更新计数器至最大值
        if (task.taskId > counter) {
          counter = task.taskId;
        }
        continue;
      }
      
      // 分配新ID
      task.taskId = counter;
      await task.save();
      console.log(`任务 ${task._id} 分配ID: ${counter}`);
    }

    // 更新计数器为当前最大值
    await Counter.findOneAndUpdate(
      { name: 'task' },
      { value: counter },
      { upsert: true }
    );
    console.log(`计数器更新为当前最大值: ${counter}`);

    console.log('任务ID迁移完成');
  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
    process.exit(0);
  }
}

// 执行迁移
migrateTaskIds(); 