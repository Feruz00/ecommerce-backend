const { CartItem, Product, File } = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getCart = catchAsync(async (req, res) => {
  const items = await CartItem.findAll({
    where: { user_id: req.user.id },
    include: [{ model: Product, as: 'product' }],
  });
  const ids = items.map((i) => i.product_id);
  const files = await File.findAll({
    where: { entity_type: 'product', entity_id: ids.map(String), is_primary: true },
  });
  const fmap = {};
  files.forEach((f) => { fmap[f.entity_id] = f.url; });

  const cart = items.map((i) => {
    const p = i.product?.toJSON() || {};
    return {
      id: i.id, quantity: i.quantity,
      product: {
        id: p.id, sku: p.sku, slug: p.slug, price: p.price, quantity: p.quantity,
        name: p.translations?.en?.name || p.sku,
        image: fmap[p.id] || null,
      },
      lineTotal: parseFloat(p.price || 0) * i.quantity,
    };
  });
  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  res.json({ status: 'success', data: { items: cart, subtotal, itemCount } });
});

exports.add = catchAsync(async (req, res, next) => {
  const { product_id, quantity = 1 } = req.body;
  const product = await Product.findByPk(product_id);
  if (!product || !product.is_active) return next(new AppError('Product unavailable', 404));
  let item = await CartItem.findOne({ where: { user_id: req.user.id, product_id } });
  if (item) { item.quantity += quantity; await item.save(); }
  else item = await CartItem.create({ user_id: req.user.id, product_id, quantity });
  res.json({ status: 'success', data: { item } });
});

exports.update = catchAsync(async (req, res, next) => {
  const item = await CartItem.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!item) return next(new AppError('Not found', 404));
  if (req.body.quantity <= 0) { await item.destroy(); return res.json({ status: 'success' }); }
  item.quantity = req.body.quantity;
  await item.save();
  res.json({ status: 'success', data: { item } });
});

exports.remove = catchAsync(async (req, res, next) => {
  const item = await CartItem.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!item) return next(new AppError('Not found', 404));
  await item.destroy();
  res.json({ status: 'success' });
});
