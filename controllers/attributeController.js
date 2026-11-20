const { Op } = require('sequelize');
const {
  Attribute,
  AttributeOption,
  ProductAttributeValue,
  VariantAttributeValue,
} = require('../models');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const lang = (req) => {
  const l = (req.headers['accept-language'] || 'en').slice(0, 2).toLowerCase();
  return ['en', 'tm', 'ru'].includes(l) ? l : 'en';
};

const mapAttr = (a, l) => {
  const j = a.toJSON ? a.toJSON() : { ...a };
  j.name = j.translations?.[l]?.name || j.translations?.en?.name || j.code;
  if (j.options) {
    j.options = j.options.map((o) => {
      const oj = o.toJSON ? o.toJSON() : { ...o };
      oj.label = oj.translations?.[l]?.label || oj.translations?.en?.label || oj.value;
      return oj;
    });
  }
  return j;
};

exports.getAll = catchAsync(async (req, res) => {
  const l = lang(req);
  const where = {};
  if (req.query.scope) where.scope = { [Op.in]: [req.query.scope, 'both'] };
  if (req.query.filterable === 'true') where.is_filterable = true;
  if (req.query.include_inactive !== 'true') where.is_active = true;

  const rows = await Attribute.findAll({
    where,
    include: [
      {
        model: AttributeOption,
        as: 'options',
        where: req.query.include_inactive === 'true' ? undefined : { is_active: true },
        required: false,
        order: [['sort_order', 'ASC']],
      },
    ],
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });

  res.json({
    status: 'success',
    data: { attributes: rows.map((a) => mapAttr(a, l)) },
  });
});

exports.getOne = catchAsync(async (req, res, next) => {
  const l = lang(req);
  const attr = await Attribute.findByPk(req.params.id, {
    include: [{ model: AttributeOption, as: 'options' }],
  });
  if (!attr) return next(new AppError('Attribute not found', 404));
  res.json({ status: 'success', data: { attribute: mapAttr(attr, l) } });
});

exports.create = catchAsync(async (req, res, next) => {
  const { code, type, scope, translations, options, ...rest } = req.body;
  if (!code || !translations) return next(new AppError('code and translations required', 400));
  if (await Attribute.findOne({ where: { code } })) {
    return next(new AppError('Attribute code already exists', 400));
  }
  const attr = await Attribute.create({
    code: code.toLowerCase().replace(/\s+/g, '_'),
    type: type || 'text',
    scope: scope || 'product',
    translations,
    is_filterable: rest.is_filterable !== false,
    is_required: !!rest.is_required,
    sort_order: rest.sort_order || 0,
    is_active: rest.is_active !== false,
    unit: rest.unit || null,
  });

  if (Array.isArray(options) && options.length && ['select', 'color'].includes(attr.type)) {
    await AttributeOption.bulkCreate(
      options.map((o, i) => ({
        attribute_id: attr.id,
        value: o.value,
        color_hex: o.color_hex || null,
        sort_order: o.sort_order ?? i,
        is_active: o.is_active !== false,
        translations: o.translations || { en: { label: o.value }, tm: { label: o.value }, ru: { label: o.value } },
      }))
    );
  }

  const full = await Attribute.findByPk(attr.id, {
    include: [{ model: AttributeOption, as: 'options' }],
  });
  res.status(201).json({ status: 'success', data: { attribute: full } });
});

exports.update = catchAsync(async (req, res, next) => {
  const attr = await Attribute.findByPk(req.params.id);
  if (!attr) return next(new AppError('Not found', 404));
  const fields = [
    'type', 'scope', 'translations', 'is_filterable', 'is_required',
    'sort_order', 'is_active', 'unit',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) attr[f] = req.body[f];
  });
  if (req.body.code) attr.code = req.body.code.toLowerCase().replace(/\s+/g, '_');
  await attr.save();

  // Replace options if provided
  if (Array.isArray(req.body.options) && ['select', 'color'].includes(attr.type)) {
    await AttributeOption.destroy({ where: { attribute_id: attr.id } });
    if (req.body.options.length) {
      await AttributeOption.bulkCreate(
        req.body.options.map((o, i) => ({
          attribute_id: attr.id,
          value: o.value,
          color_hex: o.color_hex || null,
          sort_order: o.sort_order ?? i,
          is_active: o.is_active !== false,
          translations: o.translations || { en: { label: o.value }, tm: { label: o.value }, ru: { label: o.value } },
        }))
      );
    }
  }

  const full = await Attribute.findByPk(attr.id, {
    include: [{ model: AttributeOption, as: 'options' }],
  });
  res.json({ status: 'success', data: { attribute: full } });
});

exports.remove = catchAsync(async (req, res, next) => {
  const attr = await Attribute.findByPk(req.params.id);
  if (!attr) return next(new AppError('Not found', 404));
  await ProductAttributeValue.destroy({ where: { attribute_id: attr.id } });
  await VariantAttributeValue.destroy({ where: { attribute_id: attr.id } });
  await AttributeOption.destroy({ where: { attribute_id: attr.id } });
  await attr.destroy();
  res.status(204).send();
});

/** Facets for filter UI: filterable attrs with used option counts */
exports.getFacets = catchAsync(async (req, res) => {
  const l = lang(req);
  const attrs = await Attribute.findAll({
    where: { is_active: true, is_filterable: true },
    include: [
      {
        model: AttributeOption,
        as: 'options',
        where: { is_active: true },
        required: false,
      },
    ],
    order: [['sort_order', 'ASC']],
  });
  res.json({
    status: 'success',
    data: { facets: attrs.map((a) => mapAttr(a, l)) },
  });
});
