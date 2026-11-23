"use strict";

const { Banner, File } = require("../models");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const getLanguage = (req) => {
  const header = req.headers["accept-language"] || "en";
  const language = header.slice(0, 2).toLowerCase();

  return ["en", "tm", "ru"].includes(language) ? language : "en";
};

const getTranslation = (translations, language) => {
  return (
    translations?.[language] ||
    translations?.en ||
    translations?.ru ||
    translations?.tm ||
    {}
  );
};

const mapBanner = (banner, language = "en") => {
  const item = banner.toJSON ? banner.toJSON() : { ...banner };

  const translated = getTranslation(item.translations, language);

  return {
    id: item.id,
    image_file_id: item.image_file_id,
    image: item.imageFile?.url || null,
    link: item.link,
    is_active: item.is_active,
    sort_order: item.sort_order,
    translations: item.translations || {},
    title: translated.title || "",
    text: translated.text || "",
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

const validateTranslations = (translations) => {
  if (
    translations !== undefined &&
    (typeof translations !== "object" ||
      translations === null ||
      Array.isArray(translations))
  ) {
    throw new AppError("Invalid banner translations", 400);
  }

  if (translations) {
    for (const language of ["en", "tm", "ru"]) {
      const item = translations[language];

      if (item !== undefined && (typeof item !== "object" || item === null)) {
        throw new AppError(`Invalid ${language} translation`, 400);
      }
    }
  }
};

exports.getActive = catchAsync(async (req, res) => {
  const language = getLanguage(req);

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
      banners: banners.map((banner) => mapBanner(banner, language)),
    },
  });
});

exports.getAll = catchAsync(async (req, res) => {
  const language = getLanguage(req);

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
      banners: banners.map((banner) => mapBanner(banner, language)),
    },
  });
});

exports.create = catchAsync(async (req, res) => {
  const { image_file_id, link, is_active, sort_order, translations } = req.body;

  validateTranslations(translations);

  const banner = await Banner.create({
    image_file_id: image_file_id || null,
    link: link?.trim() || null,
    is_active: is_active ?? true,
    sort_order: sort_order ?? 0,
    translations: translations || {},
  });

  const created = await Banner.findByPk(banner.id, {
    include: bannerIncludes,
  });

  res.status(201).json({
    status: "success",
    data: {
      banner: mapBanner(created, getLanguage(req)),
    },
  });
});

exports.update = catchAsync(async (req, res) => {
  const banner = await Banner.findByPk(req.params.id);

  if (!banner) {
    throw new AppError("Banner not found", 404);
  }

  const { image_file_id, link, is_active, sort_order, translations } = req.body;

  validateTranslations(translations);

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

  if (translations !== undefined) {
    updates.translations = translations;
  }

  await banner.update(updates);

  const updated = await Banner.findByPk(banner.id, {
    include: bannerIncludes,
  });

  res.json({
    status: "success",
    data: {
      banner: mapBanner(updated, getLanguage(req)),
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
