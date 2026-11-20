const { Op } = require("sequelize");
const { User } = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

exports.getAll = catchAsync(async (req, res) => {
  const { page = 1, limit = 15, role, status, search } = req.query;
  const where = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { username: { [Op.like]: `%${search}%` } },
      { first_name: { [Op.like]: `%${search}%` } },
      { last_name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }
  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ["password"] },
    limit: parseInt(limit, 10),
    offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    order: [["created_at", "DESC"]],
  });
  res.json({
    status: "success",
    total: count,
    page: parseInt(page, 10),
    data: { users: rows },
  });
});

exports.create = catchAsync(async (req, res, next) => {
  const {
    first_name,
    last_name,
    username,
    password,
    phone,
    role,
    status,
    preferred_lang,
  } = req.body;
  if (!first_name || !last_name || !username || !password) {
    return next(new AppError("Required fields missing", 400));
  }
  if (await User.findOne({ where: { username } })) {
    return next(new AppError("username already used", 400));
  }
  const allowedRoles = ["admin", "manager", "customer"];
  const user = await User.create({
    first_name,
    last_name,
    username,
    password,
    phone,
    role: allowedRoles.includes(role) ? role : "customer",
    status: status || "active",
    preferred_lang: preferred_lang || "en",
  });
  const json = user.toJSON();
  delete json.password;
  res.status(201).json({ status: "success", data: { user: json } });
});

exports.update = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError("User not found", 404));

  const fields = [
    "first_name",
    "last_name",
    "username",
    "phone",
    "role",
    "status",
    "preferred_lang",
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) user[f] = req.body[f];
  });
  if (req.body.password) user.password = req.body.password; // hashed by hook

  await user.save();
  const json = user.toJSON();
  delete json.password;
  res.json({ status: "success", data: { user: json } });
});

exports.remove = catchAsync(async (req, res, next) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return next(new AppError("User not found", 404));
  if (user.id === req.user.id)
    return next(new AppError("Cannot delete yourself", 400));
  // soft delete via status
  user.status = "inactive";
  await user.save();
  res.json({ status: "success", message: "User deactivated" });
});

exports.bulkDelete = catchAsync(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length)
    return res.json({ status: "success", message: "Nothing to delete" });
  const filtered = ids.filter((id) => id !== req.user.id);
  await User.update(
    { status: "inactive" },
    { where: { id: { [Op.in]: filtered } } },
  );
  res.json({
    status: "success",
    message: `Deactivated ${filtered.length} users`,
  });
});
