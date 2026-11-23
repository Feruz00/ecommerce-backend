"use strict";

const { Op } = require("sequelize");
const { User } = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const ALLOWED_ROLES = ["admin", "manager", "customer"];
const ALLOWED_STATUSES = ["active", "inactive", "banned"];
const ALLOWED_LANGUAGES = ["en", "tm", "ru"];

exports.getAll = catchAsync(async (req, res) => {
  const { page = 1, limit = 15, role, status, search } = req.query;

  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 100);

  const where = {};

  if (role) {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new AppError("Invalid role", 400);
    }

    where.role = role;
  }

  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new AppError("Invalid status", 400);
    }

    where.status = status;
  }

  if (search?.trim()) {
    const keyword = `%${search.trim()}%`;

    where[Op.or] = [
      { username: { [Op.like]: keyword } },
      { first_name: { [Op.like]: keyword } },
      { last_name: { [Op.like]: keyword } },
      { phone: { [Op.like]: keyword } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: { exclude: ["password"] },
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    order: [["created_at", "DESC"]],
  });

  res.json({
    status: "success",
    total: count,
    page: currentPage,
    limit: pageSize,
    data: {
      users: rows,
    },
  });
});

exports.create = catchAsync(async (req, res) => {
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

  const normalizedUsername = username?.trim();

  if (
    !first_name?.trim() ||
    !last_name?.trim() ||
    !normalizedUsername ||
    !password
  ) {
    throw new AppError("Required fields missing", 400);
  }

  if (password.length < 6) {
    throw new AppError("Password must contain at least 6 characters", 400);
  }

  if (role && !ALLOWED_ROLES.includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    throw new AppError("Invalid status", 400);
  }

  if (preferred_lang && !ALLOWED_LANGUAGES.includes(preferred_lang)) {
    throw new AppError("Invalid preferred language", 400);
  }

  const existingUser = await User.findOne({
    where: { username: normalizedUsername },
  });

  if (existingUser) {
    throw new AppError("Username already used", 400);
  }

  const user = await User.create({
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    username: normalizedUsername,
    password,
    phone: phone?.trim() || null,
    role: role || "customer",
    status: status || "active",
    preferred_lang: preferred_lang || "en",
  });

  res.status(201).json({
    status: "success",
    data: {
      user: user.toJSON(),
    },
  });
});

exports.update = catchAsync(async (req, res) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

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

  if (first_name !== undefined) {
    if (!first_name.trim()) {
      throw new AppError("First name is required", 400);
    }

    user.first_name = first_name.trim();
  }

  if (last_name !== undefined) {
    if (!last_name.trim()) {
      throw new AppError("Last name is required", 400);
    }

    user.last_name = last_name.trim();
  }

  if (username !== undefined) {
    const normalizedUsername = username.trim();

    if (!normalizedUsername) {
      throw new AppError("Username is required", 400);
    }

    const existingUser = await User.findOne({
      where: {
        username: normalizedUsername,
        id: { [Op.ne]: user.id },
      },
    });

    if (existingUser) {
      throw new AppError("Username already used", 400);
    }

    user.username = normalizedUsername;
  }

  if (phone !== undefined) {
    user.phone = phone?.trim() || null;
  }

  if (password !== undefined && password !== "") {
    if (password.length < 6) {
      throw new AppError("Password must contain at least 6 characters", 400);
    }

    user.password = password;
  }

  if (role !== undefined) {
    if (!ALLOWED_ROLES.includes(role)) {
      throw new AppError("Invalid role", 400);
    }

    user.role = role;
  }

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new AppError("Invalid status", 400);
    }

    user.status = status;
  }

  if (preferred_lang !== undefined) {
    if (!ALLOWED_LANGUAGES.includes(preferred_lang)) {
      throw new AppError("Invalid preferred language", 400);
    }

    user.preferred_lang = preferred_lang;
  }

  await user.save();

  res.json({
    status: "success",
    data: {
      user: user.toJSON(),
    },
  });
});

exports.remove = catchAsync(async (req, res) => {
  const user = await User.findByPk(req.params.id);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (String(user.id) === String(req.user.id)) {
    throw new AppError("Cannot deactivate yourself", 400);
  }

  user.status = "inactive";
  await user.save();

  res.json({
    status: "success",
    message: "User deactivated",
  });
});

exports.bulkDelete = catchAsync(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError("Please provide user IDs", 400);
  }

  // Remove duplicates and prevent self-deactivation.
  const filteredIds = [...new Set(ids.map(String))].filter(
    (id) => id !== String(req.user.id),
  );

  if (filteredIds.length === 0) {
    throw new AppError("No valid users to deactivate", 400);
  }

  const [updatedCount] = await User.update(
    { status: "inactive" },
    {
      where: {
        id: { [Op.in]: filteredIds },
        status: { [Op.ne]: "inactive" },
      },
    },
  );

  res.json({
    status: "success",
    message: `Deactivated ${updatedCount} users`,
    data: {
      updatedCount,
    },
  });
});
