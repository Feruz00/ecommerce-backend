const { Category, File } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const lang = (req) => req.headers['accept-language']?.slice(0, 2) || 'en';

const mapCat = (c, l) => {
  const j = c.toJSON ? c.toJSON() : c;
  j.name = j.translations?.[l]?.name || j.translations?.en?.name || '';
  if (j.children) j.children = j.children.map((ch) => mapCat(ch, l));
  return j;
};

exports.getTree = catchAsync(async (req, res) => {
  const l = lang(req);
  const all = await Category.findAll({
    where: { is_active: true },
    include: [{ model: File, as: 'imageFile', attributes: ['url'] }],
    order: [['sort_order', 'ASC']],
  });
  const map = {};
  all.forEach((c) => { map[c.id] = { ...mapCat(c, l), children: [], image: c.imageFile?.url }; });
  const tree = [];
  all.forEach((c) => {
    if (c.parent_id && map[c.parent_id]) map[c.parent_id].children.push(map[c.id]);
    else tree.push(map[c.id]);
  });
  res.json({ status: 'success', data: { categories: tree } });
});

exports.getAll = catchAsync(async (req, res) => {
  const l = lang(req);
  const cats = await Category.findAll({ order: [['sort_order', 'ASC']] });
  res.json({ status: 'success', data: { categories: cats.map((c) => mapCat(c, l)) } });
});

exports.create = catchAsync(async (req, res) => {
  const cat = await Category.create(req.body);
  res.status(201).json({ status: 'success', data: { category: cat } });
});

exports.update = catchAsync(async (req, res, next) => {
  const cat = await Category.findByPk(req.params.id);
  if (!cat) return next(new AppError('Not found', 404));
  await cat.update(req.body);
  res.json({ status: 'success', data: { category: cat } });
});

exports.remove = catchAsync(async (req, res, next) => {
  const cat = await Category.findByPk(req.params.id);
  if (!cat) return next(new AppError('Not found', 404));
  await cat.destroy();
  res.status(204).send();
});
