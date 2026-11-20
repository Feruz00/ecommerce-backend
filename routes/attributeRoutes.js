const r = require('express').Router();
const c = require('../controllers/attributeController');
const { protect, restrictTo } = require('../middleware/auth');

r.get('/facets', c.getFacets);
r.get('/', c.getAll);
r.get('/:id', c.getOne);

r.use(protect, restrictTo('admin', 'manager'));
r.post('/', c.create);
r.patch('/:id', c.update);
r.delete('/:id', c.remove);

module.exports = r;
