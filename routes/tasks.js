const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');

// 获取当前用户的任务 GET /api/tasks
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.user.id });
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 添加任务 POST /api/tasks
router.post('/', auth, async (req, res) => {
  const { text } = req.body;
  try {
    const newTask = new Task({ text, user: req.user.id });
    const task = await newTask.save();
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 更新任务 PUT /api/tasks/:id
router.put('/:id', auth, async (req, res) => {
  const { text, completed } = req.body;
  const taskFields = {};
  if (text) taskFields.text = text;
  if (typeof completed !== 'undefined') taskFields.completed = completed;

  try {
    let task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: '任务不存在' });
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: '没有权限' });
    }

    task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: taskFields },
      { new: true }
    );
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

// 删除任务 DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ msg: '任务不存在' });
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: '没有权限' });
    }
    await Task.findByIdAndRemove(req.params.id);
    res.json({ msg: '任务已删除' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('服务器错误');
  }
});

module.exports = router;
