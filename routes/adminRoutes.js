const r = require('express').Router();
const c = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

r.use(protect, restrictTo('admin', 'manager'));
r.get('/dashboard', c.dashboard);
r.get('/notifications', c.notifications);
r.patch('/notifications/:id/read', c.markNotificationRead);

module.exports = r;
