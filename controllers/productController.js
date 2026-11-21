"use strict";

const { Op } = require("sequelize");

const {
  Product,
  Category,
  File,
  Attribute,
  AttributeOption,
  ProductAttributeValue,
  ProductVariant,
  VariantAttributeValue,
  sequelize,
} = require("../models");

const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

/* -------------------------------------------------------------------------- */
/*                                  HELPERS                                   */
/* -------------------------------------------------------------------------- */

const language = (req) => {
  const header = String(req.headers["accept-language"] || "en")
    .slice(0, 2)
    .toLowerCase();

  return ["en", "tm", "ru"].includes(header) ? header : "en";
};

const parseBoolean = (value) =>
  value === true || ["true", "1", "yes"].includes(String(value).toLowerCase());

const plain = (record) => (record?.toJSON ? record.toJSON() : record);

/* -------------------------------------------------------------------------- */
/*                         ATTRIBUTE VALUE MAPPING                           */
/* -------------------------------------------------------------------------- */

function mapAttributeValue(record, locale) {
  const row = plain(record);
  const attribute = row.attribute || {};
  const option = row.option || null;

  let display = null;

  if (option) {
    display =
      option.translations?.[locale]?.label ||
      option.translations?.en?.label ||
      option.label ||
      option.value;
  } else if (row.value_boolean !== null && row.value_boolean !== undefined) {
    display = row.value_boolean ? "Yes" : "No";
  } else if (row.value_number !== null && row.value_number !== undefined) {
    display = String(row.value_number);
  } else if (row.value_text !== null && row.value_text !== undefined) {
    display = row.value_text;
  }

  return {
    attribute_id: row.attribute_id,
    code: attribute.code,
    name:
      attribute.translations?.[locale]?.name ||
      attribute.translations?.en?.name ||
      attribute.name ||
      attribute.code,
    type: attribute.type,
    scope: attribute.scope,
    unit: attribute.unit,
    option_id: row.option_id,
    value_text: row.value_text,
    value_number: row.value_number,
    value_boolean: row.value_boolean,
    color_hex: option?.color_hex || null,
    display,
  };
}

function mapVariant(record, locale) {
  const variant = plain(record);

  variant.image = variant.imageFile?.url || null;

  variant.attributes = (variant.attributeValues || []).map((value) =>
    mapAttributeValue(value, locale),
  );

  variant.attrs = {};

  variant.attributes.forEach((attribute) => {
    if (attribute.code) {
      variant.attrs[attribute.code] = attribute.display;
    }
  });

  delete variant.attributeValues;

  return variant;
}

function mapProduct(record, locale) {
  const product = plain(record);

  product.name =
    product.translations?.[locale]?.name ||
    product.translations?.en?.name ||
    product.slug ||
    "";

  product.shortDescription =
    product.translations?.[locale]?.shortDescription ||
    product.translations?.en?.shortDescription ||
    "";

  product.description =
    product.translations?.[locale]?.description ||
    product.translations?.en?.description ||
    "";

  if (product.category) {
    product.category.name =
      product.category.translations?.[locale]?.name ||
      product.category.translations?.en?.name ||
      product.category.name ||
      "";
  }

  if (product.primaryImage?.url) {
    product.image = product.primaryImage.url;
  } else if (Array.isArray(product.images) && product.images.length) {
    const primary =
      product.images.find((image) => image.is_primary) || product.images[0];

    product.image = primary?.url || null;
  } else {
    product.image = product.image || null;
  }

  if (product.attributeValues) {
    product.attributes = product.attributeValues.map((value) =>
      mapAttributeValue(value, locale),
    );

    delete product.attributeValues;
  }

  if (product.variants) {
    product.variants = product.variants.map((variant) =>
      mapVariant(variant, locale),
    );

    product.variants_count = product.variants.length;
  }

  return product;
}

/* -------------------------------------------------------------------------- */
/*                              ATTRIBUTE FILTERS                             */
/* -------------------------------------------------------------------------- */

function parseAttributeFilters(query) {
  const filters = [];

  if (typeof query.attrs === "string") {
    query.attrs.split(",").forEach((pair) => {
      const [code, ...rest] = pair.split(":");
      const value = rest.join(":").trim();

      if (code && value) {
        filters.push({
          code: code.trim(),
          value,
        });
      }
    });
  }

  Object.keys(query).forEach((key) => {
    if (key.startsWith("attr_") && query[key]) {
      filters.push({
        code: key.slice(5),
        value: String(query[key]),
      });
    }
  });

  if (query.attr && typeof query.attr === "object") {
    Object.entries(query.attr).forEach(([code, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        filters.push({
          code,
          value: String(value),
        });
      }
    });
  }

  return filters;
}

async function findProductIdsByAttributeFilters(filters) {
  if (!filters.length) return null;

  let matchedIds = null;

  for (const filter of filters) {
    const attribute = await Attribute.findOne({
      where: {
        code: filter.code,
        is_active: true,
      },
    });

    if (!attribute) {
      matchedIds = [];
      break;
    }

    const where = {
      attribute_id: attribute.id,
    };

    if (["select", "color"].includes(attribute.type)) {
      const option = await AttributeOption.findOne({
        where: {
          attribute_id: attribute.id,
          [Op.or]: [
            { value: filter.value },
            sequelize.where(
              sequelize.fn("LOWER", sequelize.col("value")),
              filter.value.toLowerCase(),
            ),
          ],
        },
      });

      if (option) {
        where.option_id = option.id;
      } else {
        where.value_text = {
          [Op.like]: `%${filter.value}%`,
        };
      }
    } else if (attribute.type === "number") {
      where.value_number = Number(filter.value);
    } else if (attribute.type === "boolean") {
      where.value_boolean = parseBoolean(filter.value);
    } else {
      where.value_text = {
        [Op.like]: `%${filter.value}%`,
      };
    }

    const values = await ProductAttributeValue.findAll({
      where,
      attributes: ["product_id"],
      raw: true,
    });

    const ids = values.map((value) => value.product_id);

    matchedIds =
      matchedIds === null ? ids : matchedIds.filter((id) => ids.includes(id));

    if (!matchedIds.length) break;
  }

  return matchedIds;
}

/* -------------------------------------------------------------------------- */
/*                         ATTRIBUTE VALUE VALIDATION                         */
/* -------------------------------------------------------------------------- */

async function validateAttributeRows(
  rows,
  scope,
  transaction,
  isVariant = false,
) {
  if (!Array.isArray(rows)) return [];

  const normalized = [];
  const seen = new Set();

  for (const row of rows) {
    if (!row?.attribute_id) continue;

    const key = String(row.attribute_id);

    if (seen.has(key)) {
      throw new AppError(
        "An attribute can only be provided once per product or variant",
        400,
      );
    }

    seen.add(key);

    const attribute = await Attribute.findByPk(row.attribute_id, {
      transaction,
    });

    if (!attribute || attribute.is_active === false) {
      throw new AppError(
        `Attribute ${row.attribute_id} was not found or is inactive`,
        400,
      );
    }

    const allowedScopes =
      scope === "product" ? ["product", "both"] : ["variant", "both"];

    if (!allowedScopes.includes(attribute.scope)) {
      throw new AppError(
        `Attribute "${attribute.code}" cannot be used for ${scope}`,
        400,
      );
    }

    const value = {
      attribute_id: attribute.id,
      option_id: null,
      value_text: null,
      value_number: null,
      value_boolean: null,
    };

    if (["select", "color"].includes(attribute.type)) {
      if (!row.option_id) {
        throw new AppError(`Choose an option for "${attribute.code}"`, 400);
      }

      const option = await AttributeOption.findOne({
        where: {
          id: row.option_id,
          attribute_id: attribute.id,
        },
        transaction,
      });

      if (!option) {
        throw new AppError(`Invalid option for "${attribute.code}"`, 400);
      }

      value.option_id = option.id;
    } else if (attribute.type === "number") {
      const number = isVariant
        ? row.value_text === "" || row.value_text == null
          ? null
          : Number(row.value_text)
        : row.value_number;

      if (number == null || !Number.isFinite(Number(number))) {
        throw new AppError(`Enter a valid number for "${attribute.code}"`, 400);
      }

      if (isVariant) {
        value.value_text = String(number);
      } else {
        value.value_number = Number(number);
      }
    } else if (attribute.type === "boolean") {
      const booleanValue =
        row.value_boolean !== undefined
          ? parseBoolean(row.value_boolean)
          : parseBoolean(row.value_text);

      if (isVariant) {
        value.value_text = String(booleanValue);
      } else {
        value.value_boolean = booleanValue;
      }
    } else {
      const textValue = row.value_text;

      if (
        textValue !== undefined &&
        textValue !== null &&
        String(textValue).trim() !== ""
      ) {
        value.value_text = String(textValue).trim();
      }
    }

    normalized.push(value);
  }

  return normalized;
}

/* -------------------------------------------------------------------------- */
/*                           SAVE PRODUCT ATTRIBUTES                          */
/* -------------------------------------------------------------------------- */

async function saveProductAttributes(productId, rows, transaction) {
  const normalized = await validateAttributeRows(
    rows,
    "product",
    transaction,
    false,
  );

  if (normalized.length) {
    await ProductAttributeValue.bulkCreate(
      normalized.map((value) => ({
        ...value,
        product_id: productId,
      })),
      { transaction },
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                                FILE HELPERS                                */
/* -------------------------------------------------------------------------- */

async function attachFileToEntity(
  fileId,
  entityType,
  entityId,
  transaction,
  isPrimary = true,
) {
  if (!fileId) return;

  const file = await File.findByPk(fileId, {
    transaction,
  });

  if (!file) {
    throw new AppError("Uploaded image file was not found", 400);
  }

  await file.update(
    {
      entity_type: entityType,
      entity_id: String(entityId),
      is_primary: isPrimary,
    },
    { transaction },
  );
}

/* -------------------------------------------------------------------------- */
/*                           SAVE VARIANT ATTRIBUTES                          */
/* -------------------------------------------------------------------------- */

async function saveVariantAttributes(variantId, rows, transaction) {
  const normalized = await validateAttributeRows(
    rows,
    "variant",
    transaction,
    true,
  );

  if (normalized.length) {
    await VariantAttributeValue.bulkCreate(
      normalized.map((value) => ({
        ...value,
        variant_id: variantId,
      })),
      { transaction },
    );
  }
}

/* -------------------------------------------------------------------------- */
/*                              SYNC PRODUCT VARIANTS                         */
/* -------------------------------------------------------------------------- */

async function syncVariants(productId, rows, transaction) {
  if (!Array.isArray(rows)) return;

  const existing = await ProductVariant.findAll({
    where: {
      product_id: productId,
    },
    transaction,
  });

  const existingById = new Map(
    existing.map((variant) => [String(variant.id), variant]),
  );

  const retainedIds = new Set();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    if (!row?.sku || !String(row.sku).trim()) {
      throw new AppError(`Variant ${index + 1}: SKU is required`, 400);
    }

    let variant;

    if (row.id) {
      variant = existingById.get(String(row.id));

      if (!variant) {
        throw new AppError(
          `Variant ${row.id} does not belong to this product`,
          400,
        );
      }

      await variant.update(
        {
          sku: String(row.sku).trim(),
          price: row.price ?? null,
          compare_at_price: row.compare_at_price ?? null,
          quantity: row.quantity ?? 0,
          is_active: row.is_active !== false,
          image_file_id: row.image_file_id || null,
          sort_order: row.sort_order ?? index,
        },
        { transaction },
      );
    } else {
      variant = await ProductVariant.create(
        {
          product_id: productId,
          sku: String(row.sku).trim(),
          price: row.price ?? null,
          compare_at_price: row.compare_at_price ?? null,
          quantity: row.quantity ?? 0,
          is_active: row.is_active !== false,
          image_file_id: row.image_file_id || null,
          sort_order: row.sort_order ?? index,
        },
        { transaction },
      );
    }

    retainedIds.add(String(variant.id));

    await VariantAttributeValue.destroy({
      where: {
        variant_id: variant.id,
      },
      transaction,
    });

    await saveVariantAttributes(variant.id, row.attributes || [], transaction);

    if (row.image_file_id) {
      await attachFileToEntity(
        row.image_file_id,
        "variant",
        variant.id,
        transaction,
        true,
      );
    }
  }

  const removedIds = existing
    .filter((variant) => !retainedIds.has(String(variant.id)))
    .map((variant) => variant.id);

  if (removedIds.length) {
    await VariantAttributeValue.destroy({
      where: {
        variant_id: {
          [Op.in]: removedIds,
        },
      },
      transaction,
    });

    await File.destroy({
      where: {
        entity_type: "variant",
        entity_id: {
          [Op.in]: removedIds.map(String),
        },
      },
      transaction,
    });

    await ProductVariant.destroy({
      where: {
        id: {
          [Op.in]: removedIds,
        },
        product_id: productId,
      },
      transaction,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                              PRODUCT INCLUDES                              */
/* -------------------------------------------------------------------------- */

function productIncludes({
  includeVariants = false,
  includeAttributes = false,
} = {}) {
  const includes = [
    {
      model: Category,
      as: "category",
      attributes: ["id", "slug", "translations"],
    },
    {
      model: File,
      as: "primaryImage",
      required: false,
      attributes: ["id", "url", "alt", "is_primary"],
    },
  ];

  if (includeAttributes) {
    includes.push({
      model: ProductAttributeValue,
      as: "attributeValues",
      required: false,
      include: [
        {
          model: Attribute,
          as: "attribute",
        },
        {
          model: AttributeOption,
          as: "option",
        },
      ],
    });
  }

  if (includeVariants) {
    includes.push({
      model: ProductVariant,
      as: "variants",
      required: false,
      include: [
        {
          model: File,
          as: "imageFile",
          attributes: ["id", "url"],
        },
        {
          model: VariantAttributeValue,
          as: "attributeValues",
          include: [
            {
              model: Attribute,
              as: "attribute",
            },
            {
              model: AttributeOption,
              as: "option",
            },
          ],
        },
      ],
    });
  }

  return includes;
}

/* -------------------------------------------------------------------------- */
/*                              GET ALL PRODUCTS                              */
/* -------------------------------------------------------------------------- */

exports.getAll = catchAsync(async (req, res) => {
  const locale = language(req);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 100);

  const { category, search, featured, minPrice, maxPrice } = req.query;

  const sort = req.query.sort || "created_at";
  const where = {};

  if (req.query.include_inactive !== "true") {
    where.is_active = true;
  }

  if (category) {
    const categoryRows = await Category.findAll({
      where: {
        [Op.or]: [{ id: category }, { parent_id: category }],
      },
      attributes: ["id"],
    });

    where.category_id = {
      [Op.in]: [category, ...categoryRows.map((item) => item.id)],
    };
  }

  if (featured === "true") {
    where.is_featured = true;
  }

  if (minPrice !== undefined && minPrice !== "") {
    where.price = {
      ...(where.price || {}),
      [Op.gte]: Number(minPrice),
    };
  }

  if (maxPrice !== undefined && maxPrice !== "") {
    where.price = {
      ...(where.price || {}),
      [Op.lte]: Number(maxPrice),
    };
  }

  /* ------------------------------- SEARCH -------------------------------- */

  if (search) {
    const searchTerm = String(search).trim();
    const query = `%${searchTerm}%`;

    const attributeHits = await ProductAttributeValue.findAll({
      where: {
        value_text: {
          [Op.like]: query,
        },
      },
      attributes: ["product_id"],
      raw: true,
    });

    const productIds = [
      ...new Set(attributeHits.map((item) => item.product_id)),
    ];

    where[Op.or] = [
      {
        sku: {
          [Op.like]: query,
        },
      },
      {
        slug: {
          [Op.like]: query,
        },
      },

      // IMPORTANT: explicitly reference Product table.
      // This prevents ambiguity with Category.translations.
      sequelize.literal(
        `LOWER(CAST(\`Product\`.\`translations\` AS CHAR)) LIKE ${sequelize.escape(
          query.toLowerCase(),
        )}`,
      ),

      ...(productIds.length
        ? [
            {
              id: {
                [Op.in]: productIds,
              },
            },
          ]
        : []),
    ];
  }

  /* --------------------------- ATTRIBUTE FILTERS ------------------------- */

  const filters = parseAttributeFilters(req.query);

  if (filters.length) {
    const ids = await findProductIdsByAttributeFilters(filters);

    where.id = {
      ...(where.id || {}),
      [Op.in]: ids || [],
    };
  }

  /* -------------------------------- SORT --------------------------------- */

  const allowedSorts = [
    "created_at",
    "updated_at",
    "sold_count",
    "view_count",
    "price",
  ];

  const order =
    sort === "price_desc"
      ? [["price", "DESC"]]
      : allowedSorts.includes(sort)
        ? [[sort, sort === "price" ? "ASC" : "DESC"]]
        : [["created_at", "DESC"]];

  /* ------------------------------- QUERY --------------------------------- */

  const { count, rows } = await Product.findAndCountAll({
    where,
    include: productIncludes(),
    limit,
    offset: (page - 1) * limit,
    order,
    distinct: true,
  });

  const products = rows.map((row) => mapProduct(row, locale));

  res.json({
    status: "success",
    results: products.length,
    total: count,
    page,
    totalPages: Math.ceil(count / limit) || 1,
    data: {
      products,
    },
  });
});

/* -------------------------------------------------------------------------- */
/*                               GET ONE PRODUCT                              */
/* -------------------------------------------------------------------------- */

exports.getOne = catchAsync(async (req, res, next) => {
  const locale = language(req);

  const product = await Product.findOne({
    where: {
      [Op.or]: [{ id: req.params.id }, { slug: req.params.id }],
      ...(req.query.include_inactive === "true" ? {} : { is_active: true }),
    },
    include: [
      ...productIncludes({
        includeAttributes: true,
        includeVariants: true,
      }),
      {
        model: File,
        as: "images",
        required: false,
        attributes: ["id", "url", "alt", "is_primary", "sort_order"],
        separate: true,
        order: [
          ["is_primary", "DESC"],
          ["sort_order", "ASC"],
        ],
      },
    ],
  });

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  Product.increment("view_count", {
    where: {
      id: product.id,
    },
  }).catch(() => {});

  const related = await Product.findAll({
    where: {
      category_id: product.category_id,
      id: {
        [Op.ne]: product.id,
      },
      is_active: true,
    },
    include: [
      {
        model: File,
        as: "primaryImage",
        required: false,
        attributes: ["id", "url"],
      },
    ],
    limit: 8,
    order: [["sold_count", "DESC"]],
  });

  const mapped = mapProduct(product, locale);

  mapped.related = related.map((item) => mapProduct(item, locale));

  res.json({
    status: "success",
    data: {
      product: mapped,
    },
  });
});

/* -------------------------------------------------------------------------- */
/*                              CREATE PRODUCT                                */
/* -------------------------------------------------------------------------- */

exports.create = catchAsync(async (req, res) => {
  const {
    attributes,
    variants,
    image_file_id: imageFileId,
    image_url: imageUrl,
    ...body
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const product = await Product.create(body, {
      transaction,
    });

    if (imageFileId) {
      await attachFileToEntity(
        imageFileId,
        "product",
        product.id,
        transaction,
        true,
      );
    } else if (imageUrl) {
      await File.create(
        {
          original_name: "product",
          filename: "product",
          path: imageUrl,
          url: imageUrl,
          entity_type: "product",
          entity_id: String(product.id),
          is_primary: true,
          mime_type: "image/jpeg",
          disk: "url",
        },
        { transaction },
      );
    }

    if (Array.isArray(attributes)) {
      await saveProductAttributes(product.id, attributes, transaction);
    }

    if (Array.isArray(variants)) {
      await syncVariants(product.id, variants, transaction);
    }

    await transaction.commit();

    const created = await Product.findByPk(product.id, {
      include: productIncludes({
        includeAttributes: true,
        includeVariants: true,
      }),
    });

    res.status(201).json({
      status: "success",
      data: {
        product: mapProduct(created, language(req)),
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
});

/* -------------------------------------------------------------------------- */
/*                              UPDATE PRODUCT                                */
/* -------------------------------------------------------------------------- */

exports.update = catchAsync(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const product = await Product.findByPk(req.params.id, {
      transaction,
    });

    if (!product) {
      await transaction.rollback();
      return next(new AppError("Product not found", 404));
    }

    const {
      attributes,
      variants,
      image_file_id: imageFileId,
      image_url: imageUrl,
      ...body
    } = req.body;

    await product.update(body, {
      transaction,
    });

    if (imageFileId) {
      await File.update(
        {
          is_primary: false,
        },
        {
          where: {
            entity_type: "product",
            entity_id: String(product.id),
          },
          transaction,
        },
      );

      await attachFileToEntity(
        imageFileId,
        "product",
        product.id,
        transaction,
        true,
      );
    } else if (imageUrl) {
      await File.destroy({
        where: {
          entity_type: "product",
          entity_id: String(product.id),
          is_primary: true,
          disk: "url",
        },
        transaction,
      });

      await File.create(
        {
          original_name: "product",
          filename: "product",
          path: imageUrl,
          url: imageUrl,
          entity_type: "product",
          entity_id: String(product.id),
          is_primary: true,
          mime_type: "image/jpeg",
          disk: "url",
        },
        { transaction },
      );
    }

    if (Array.isArray(attributes)) {
      await ProductAttributeValue.destroy({
        where: {
          product_id: product.id,
        },
        transaction,
      });

      await saveProductAttributes(product.id, attributes, transaction);
    }

    if (Array.isArray(variants)) {
      await syncVariants(product.id, variants, transaction);
    }

    await transaction.commit();

    const updated = await Product.findByPk(product.id, {
      include: productIncludes({
        includeAttributes: true,
        includeVariants: true,
      }),
    });

    res.json({
      status: "success",
      data: {
        product: mapProduct(updated, language(req)),
      },
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
});

/* -------------------------------------------------------------------------- */
/*                              DELETE HELPERS                                */
/* -------------------------------------------------------------------------- */

async function deleteProducts(ids, transaction) {
  await ProductAttributeValue.destroy({
    where: {
      product_id: {
        [Op.in]: ids,
      },
    },
    transaction,
  });

  const variants = await ProductVariant.findAll({
    where: {
      product_id: {
        [Op.in]: ids,
      },
    },
    attributes: ["id"],
    transaction,
  });

  const variantIds = variants.map((variant) => variant.id);

  if (variantIds.length) {
    await VariantAttributeValue.destroy({
      where: {
        variant_id: {
          [Op.in]: variantIds,
        },
      },
      transaction,
    });

    await ProductVariant.destroy({
      where: {
        id: {
          [Op.in]: variantIds,
        },
      },
      transaction,
    });
  }

  await File.destroy({
    where: {
      [Op.or]: [
        {
          entity_type: "product",
          entity_id: {
            [Op.in]: ids.map(String),
          },
        },
        {
          entity_type: "variant",
          entity_id: {
            [Op.in]: variantIds.map(String),
          },
        },
      ],
    },
    transaction,
  });

  await Product.destroy({
    where: {
      id: {
        [Op.in]: ids,
      },
    },
    transaction,
  });
}

/* -------------------------------------------------------------------------- */
/*                               DELETE PRODUCT                               */
/* -------------------------------------------------------------------------- */

exports.remove = catchAsync(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const product = await Product.findByPk(req.params.id, {
      transaction,
    });

    if (!product) {
      await transaction.rollback();
      return next(new AppError("Product not found", 404));
    }

    await deleteProducts([product.id], transaction);

    await transaction.commit();

    res.status(204).send();
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
});

/* -------------------------------------------------------------------------- */
/*                            BULK DELETE PRODUCTS                            */
/* -------------------------------------------------------------------------- */

exports.bulkDelete = catchAsync(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids)] : [];

  if (!ids.length) {
    return res.json({
      status: "success",
      message: "Nothing to delete",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    await deleteProducts(ids, transaction);

    await transaction.commit();

    res.json({
      status: "success",
      message: `Deleted ${ids.length} products`,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
});
