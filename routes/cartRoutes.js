const r = require('express').Router();
const c = require('../controllers/cartController');
const { protect } = require('../middleware/auth');
r.use(protect);
r.get('/', c.getCart);
r.post('/', c.add);
r.patch('/:id', c.update);
r.delete('/:id', c.remove);
module.exports = r;
