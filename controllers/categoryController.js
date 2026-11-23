const { Category, File } = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const lang = (req) => {
  const header = req.headers["accept-language"] || "en";
  return header.slice(0, 2).toLowerCase();
};

const mapCategory = (category, language) => {
  const item = category.toJSON ? category.toJSON() : { ...category };

  item.name =
    item.translations?.[language]?.name || item.translations?.en?.name || "";

  item.image = item.imageFile?.url || null;

  return item;
};

const buildTree = (categories, language) => {
  const map = {};

  categories.forEach((category) => {
    const item = mapCategory(category, language);

    map[item.id] = {
      ...item,
      children: [],
    };
  });

  const tree = [];

  categories.forEach((category) => {
    const item = map[category.id];

    if (category.parent_id && map[category.parent_id]) {
      map[category.parent_id].children.push(item);
    } else {
      tree.push(item);
    }
  });

  return tree;
};

// Prevent a category from being its own parent or a descendant of itself.
const validateParent = async (parentId, categoryId = null) => {
  if (!parentId) return;

  const parent = await Category.findByPk(parentId);

  if (!parent) {
    throw new AppError("Parent category not found", 404);
  }

  let current = parent;

  while (current) {
    if (categoryId && Number(current.id) === Number(categoryId)) {
      throw new AppError(
        "A category cannot be moved inside itself or one of its descendants",
        400,
      );
    }

    if (!current.parent_id) break;

    current = await Category.findByPk(current.parent_id);

    if (!current) break;
  }
};

const categoryIncludes = [
  {
    model: File,
    as: "imageFile",
    attributes: ["id", "url"],
    required: false,
  },
];

exports.getTree = catchAsync(async (req, res) => {
  const language = lang(req);

  const categories = await Category.findAll({
    where: { is_active: true },
    include: categoryIncludes,
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
  });

  const tree = buildTree(categories, language);

  res.json({
    status: "success",
    data: {
      categories: tree,
    },
  });
});

exports.getAll = catchAsync(async (req, res) => {
  const language = lang(req);

  const categories = await Category.findAll({
    include: categoryIncludes,
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
  });

  const tree = buildTree(categories, language);

  res.json({
    status: "success",
    data: {
      categories: tree,
    },
  });
});

exports.create = catchAsync(async (req, res) => {
  const { parent_id, sort_order, is_active, image_file_id, translations } =
    req.body;

  await validateParent(parent_id);

  const category = await Category.create({
    parent_id: parent_id || null,
    sort_order: sort_order ?? 0,
    is_active: is_active ?? true,
    image_file_id: image_file_id || null,
    translations: translations || {},
  });

  const created = await Category.findByPk(category.id, {
    include: categoryIncludes,
  });

  res.status(201).json({
    status: "success",
    data: {
      category: mapCategory(created, lang(req)),
    },
  });
});

exports.update = catchAsync(async (req, res) => {
  const category = await Category.findByPk(req.params.id);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  const { parent_id, sort_order, is_active, image_file_id, translations } =
    req.body;

  if (Object.prototype.hasOwnProperty.call(req.body, "parent_id")) {
    await validateParent(parent_id, category.id);
  }

  const updates = {};

  if (parent_id !== undefined || "parent_id" in req.body) {
    updates.parent_id = parent_id || null;
  }

  if (sort_order !== undefined) {
    updates.sort_order = sort_order;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
  }

  if (image_file_id !== undefined) {
    updates.image_file_id = image_file_id || null;
  }

  if (translations !== undefined) {
    updates.translations = translations;
  }

  await category.update(updates);

  const updated = await Category.findByPk(category.id, {
    include: categoryIncludes,
  });

  res.json({
    status: "success",
    data: {
      category: mapCategory(updated, lang(req)),
    },
  });
});

exports.remove = catchAsync(async (req, res) => {
  const category = await Category.findByPk(req.params.id);

  if (!category) {
    throw new AppError("Category not found", 404);
  }

  const childrenCount = await Category.count({
    where: { parent_id: category.id },
  });

  if (childrenCount > 0) {
    throw new AppError("Cannot delete a category that has subcategories", 400);
  }

  await category.destroy();

  res.status(204).send();
});
