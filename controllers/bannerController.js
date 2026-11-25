"use strict";

const { Banner, File } = require("../models");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const mapBanner = (banner, language = "en") => {
  const item = banner.toJSON ? banner.toJSON() : { ...banner };

  return {
    id: item.id,
    image_file_id: item.image_file_id,
    image: item.imageFile?.url || null,
    link: item.link,
    is_active: item.is_active,
    sort_order: item.sort_order,
  };
};

const bannerIncludes = [
  {
    model: File,
    as: "imageFile",
    attributes: ["id", "url"],
    required: false,
  },
];

exports.getActive = catchAsync(async (req, res) => {
  const banners = await Banner.findAll({
    where: { is_active: true },
    include: bannerIncludes,
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
  });

  res.json({
    status: "success",
    data: {
      banners: banners.map((banner) => mapBanner(banner)),
    },
  });
});

exports.getAll = catchAsync(async (req, res) => {
  // const language = getLanguage(req);

  const banners = await Banner.findAll({
    include: bannerIncludes,
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
  });

  res.json({
    status: "success",
    data: {
      banners: banners.map((banner) => mapBanner(banner)),
    },
  });
});

exports.create = catchAsync(async (req, res) => {
  const { image_file_id, link, is_active, sort_order } = req.body;

  // validateTranslations(translations);

  const banner = await Banner.create({
    image_file_id: image_file_id || null,
    link: link?.trim() || null,
    is_active: is_active ?? true,
    sort_order: sort_order ?? 0,
  });

  const created = await Banner.findByPk(banner.id, {
    include: bannerIncludes,
  });

  res.status(201).json({
    status: "success",
    data: {
      banner: mapBanner(created),
    },
  });
});

exports.update = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError("Banner not found", 404);
  }

  const { image_file_id, link, is_active, sort_order } = req.body;

  // validateTranslations(translations);

  const updates = {};

  if (image_file_id !== undefined) {
    updates.image_file_id = image_file_id || null;
  }

  if (link !== undefined) {
    updates.link = link?.trim() || null;
  }

  if (is_active !== undefined) {
    updates.is_active = is_active;
  }

  if (sort_order !== undefined) {
    updates.sort_order = sort_order;
  }

  await banner.update(updates);

  const updated = await Banner.findByPk(banner.id, {
    include: bannerIncludes,
  });

  res.json({
    status: "success",
    data: {
      banner: mapBanner(updated),
    },
  });
});

exports.remove = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError("Banner not found", 404);
  }

  await banner.destroy();

  res.status(204).send();
});
