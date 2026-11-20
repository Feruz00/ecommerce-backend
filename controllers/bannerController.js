const { Banner, File } = require('../models');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const lang = (req) => req.headers['accept-language']?.slice(0, 2) || 'en';

exports.getActive = catchAsync(async (req, res) => {
  const l = lang(req);
  const banners = await Banner.findAll({
    where: { is_active: true },
    include: [{ model: File, as: 'imageFile', attributes: ['url'] }],
    order: [['sort_order', 'ASC']],
  });
  const data = banners.map((b) => ({
    id: b.id,
    title: b.translations?.[l]?.title || b.translations?.en?.title || '',
    link: b.link,
    image: b.imageFile?.url,
  }));
  res.json({ status: 'success', data: { banners: data } });
});

exports.getAll = catchAsync(async (req, res) => {
  const banners = await Banner.findAll({
    include: [{ model: File, as: 'imageFile' }],
    order: [['sort_order', 'ASC']],
  });
  res.json({ status: 'success', data: { banners } });
});

exports.create = catchAsync(async (req, res) => {
  let image_file_id = req.body.image_file_id;
  if (req.body.image_url && !image_file_id) {
    const f = await File.create({
      original_name: 'banner', filename: 'banner', path: req.body.image_url, url: req.body.image_url,
      entity_type: 'banner', mime_type: 'image/jpeg',
    });
    image_file_id = f.id;
  }
  const banner = await Banner.create({ ...req.body, image_file_id });
  res.status(201).json({ status: 'success', data: { banner } });
});

exports.update = catchAsync(async (req, res, next) => {
  const banner = await Banner.findByPk(req.params.id);
  if (!banner) return next(new AppError('Not found', 404));
  await banner.update(req.body);
  res.json({ status: 'success', data: { banner } });
});

exports.remove = catchAsync(async (req, res, next) => {
  const banner = await Banner.findByPk(req.params.id);
  if (!banner) return next(new AppError('Not found', 404));
  await banner.destroy();
  res.status(204).send();
});
