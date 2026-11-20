"use strict";

const {
  CartItem,
  Product,
  ProductVariant,
  File,
  VariantAttributeValue,
  Attribute,
  AttributeOption,
} = require("../models");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getVariantPrice = (variant, product) => {
  if (
    variant?.price !== undefined &&
    variant?.price !== null &&
    variant?.price !== ""
  ) {
    return toNumber(variant.price);
  }
  return toNumber(product?.price);
};

/**
 * Build a readable snapshot of selected attributes for a variant.
 * Prefer values already stored on the cart item; otherwise derive from DB.
 */
function buildAttributeSnapshot(variant, cartSelected) {
  // If client already sent human-readable labels, keep them.
  if (
    cartSelected &&
    typeof cartSelected === "object" &&
    Object.keys(cartSelected).length > 0
  ) {
    const snapshot = { ...cartSelected };
    if (variant?.id && !snapshot.variant_id) {
      snapshot.variant_id = variant.id;
    }
    return snapshot;
  }

  const snapshot = {};
  if (variant?.id) snapshot.variant_id = variant.id;

  const entries =
    variant?.attributeValues || variant?.attributes || variant?.options || [];

  for (const entry of entries) {
    const code =
      entry?.attribute?.code ||
      entry?.definition?.code ||
      entry?.code ||
      entry?.attribute_code ||
      entry?.attribute?.slug;

    if (!code) continue;

    const label =
      entry?.option?.translations?.en?.name ||
      entry?.option?.translations?.ru?.name ||
      entry?.option?.name ||
      entry?.option?.label ||
      entry?.option?.value ||
      entry?.value_text ||
      entry?.display ||
      entry?.value ||
      null;

    if (label !== null && label !== undefined && label !== "") {
      snapshot[code] = String(label);
    }
  }

  return snapshot;
}

exports.getCart = catchAsync(async (req, res) => {
  const items = await CartItem.findAll({
    where: { user_id: req.user.id },
    include: [
      {
        model: Product,
        as: "product",
      },
      {
        model: ProductVariant,
        as: "variant",
        required: false,
        include: [
          {
            model: VariantAttributeValue,
            as: "attributeValues",
            required: false,
            include: [
              { model: Attribute, as: "attribute", required: false },
              { model: AttributeOption, as: "option", required: false },
            ],
          },
        ],
      },
    ],
    order: [["created_at", "ASC"]],
  });

  const productIds = [
    ...new Set(items.map((i) => String(i.product_id)).filter(Boolean)),
  ];

  const files = productIds.length
    ? await File.findAll({
        where: {
          entity_type: "product",
          entity_id: productIds,
          is_primary: true,
        },
      })
    : [];

  const fmap = {};
  files.forEach((f) => {
    fmap[String(f.entity_id)] = f.url;
  });

  // Also try variant-level primary images if File supports it.
  const variantIds = items
    .map((i) => i.variant_id)
    .filter(Boolean)
    .map(String);

  let variantFileMap = {};
  if (variantIds.length) {
    try {
      const vFiles = await File.findAll({
        where: {
          entity_type: "product_variant",
          entity_id: variantIds,
          is_primary: true,
        },
      });
      vFiles.forEach((f) => {
        variantFileMap[String(f.entity_id)] = f.url;
      });
    } catch {
      // entity_type may not support variants – ignore
    }
  }

  const cart = items.map((item) => {
    const p = item.product?.toJSON?.() || item.product || {};
    const v = item.variant?.toJSON?.() || item.variant || null;

    const unitPrice = v ? getVariantPrice(v, p) : toNumber(p.price);

    const selectedAttributes =
      item.selected_attributes || (v ? buildAttributeSnapshot(v, null) : null);

    const image =
      (v && (variantFileMap[String(v.id)] || v.image || v.imageFile?.url)) ||
      fmap[String(p.id)] ||
      p.image ||
      null;

    const name =
      p.translations?.ru?.name ||
      p.translations?.en?.name ||
      p.translations?.tm?.name ||
      p.name ||
      p.sku ||
      "Product";

    return {
      id: item.id,
      quantity: item.quantity,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      selected_attributes: selectedAttributes,
      product: {
        id: p.id,
        sku: p.sku,
        slug: p.slug,
        price: toNumber(p.price),
        quantity: p.quantity,
        name,
        translations: p.translations || null,
        image,
      },
      variant: v
        ? {
            id: v.id,
            sku: v.sku || v.variant_sku || null,
            price: getVariantPrice(v, p),
            quantity: v.quantity,
            is_active: v.is_active,
            image: variantFileMap[String(v.id)] || v.image || null,
            attributeValues: v.attributeValues || null,
          }
        : null,
      // Convenience fields used by frontend utils
      unitPrice,
      lineTotal: unitPrice * item.quantity,
    };
  });

  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);

  res.json({
    status: "success",
    data: { items: cart, subtotal, itemCount },
  });
});

exports.add = catchAsync(async (req, res, next) => {
  const {
    product_id,
    variant_id = null,
    quantity = 1,
    selected_attributes = null,
  } = req.body || {};

  const qty = Number(quantity);
  if (!product_id || !Number.isInteger(qty) || qty < 1) {
    return next(new AppError("Invalid product or quantity", 400));
  }

  const product = await Product.findByPk(product_id);
  if (!product || !product.is_active) {
    return next(new AppError("Product unavailable", 404));
  }

  let variant = null;
  let finalVariantId = variant_id || null;
  let attributesSnapshot = selected_attributes || null;

  if (finalVariantId) {
    variant = await ProductVariant.findByPk(finalVariantId, {
      include: [
        {
          model: VariantAttributeValue,
          as: "attributeValues",
          required: false,
          include: [
            { model: Attribute, as: "attribute", required: false },
            { model: AttributeOption, as: "option", required: false },
          ],
        },
      ],
    });

    if (
      !variant ||
      String(variant.product_id) !== String(product.id) ||
      variant.is_active === false
    ) {
      return next(new AppError("Selected product variant is unavailable", 400));
    }

    if (Number(variant.quantity) < qty) {
      return next(
        new AppError(
          `Insufficient stock for this variant (available: ${variant.quantity})`,
          400,
        ),
      );
    }

    attributesSnapshot = buildAttributeSnapshot(variant, selected_attributes);
  } else {
    // Product has active variants → client must pick one
    const variantCount = await ProductVariant.count({
      where: { product_id: product.id, is_active: true },
    });

    if (variantCount > 0) {
      return next(
        new AppError(
          "Please select a product variant before adding to cart",
          400,
        ),
      );
    }

    if (Number(product.quantity) < qty) {
      return next(
        new AppError(
          `Insufficient stock (available: ${product.quantity})`,
          400,
        ),
      );
    }
  }

  // Unique key: user + product + variant (variant_id can be null)
  const where = {
    user_id: req.user.id,
    product_id,
    variant_id: finalVariantId,
  };

  let item = await CartItem.findOne({ where });

  if (item) {
    const newQty = item.quantity + qty;

    // Re-check stock for the merged quantity
    if (variant && Number(variant.quantity) < newQty) {
      return next(
        new AppError(
          `Insufficient stock for this variant (available: ${variant.quantity})`,
          400,
        ),
      );
    }
    if (!variant && Number(product.quantity) < newQty) {
      return next(
        new AppError(
          `Insufficient stock (available: ${product.quantity})`,
          400,
        ),
      );
    }

    item.quantity = newQty;
    if (attributesSnapshot) {
      item.selected_attributes = attributesSnapshot;
    }
    await item.save();
  } else {
    item = await CartItem.create({
      user_id: req.user.id,
      product_id,
      variant_id: finalVariantId,
      quantity: qty,
      selected_attributes: attributesSnapshot,
    });
  }

  res.json({
    status: "success",
    data: { item },
  });
});

exports.update = catchAsync(async (req, res, next) => {
  const item = await CartItem.findOne({
    where: { id: req.params.id, user_id: req.user.id },
    include: [
      { model: Product, as: "product" },
      { model: ProductVariant, as: "variant", required: false },
    ],
  });

  if (!item) return next(new AppError("Not found", 404));

  const quantity = Number(req.body.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    await item.destroy();
    return res.json({ status: "success" });
  }

  // Stock check
  if (item.variant_id && item.variant) {
    if (Number(item.variant.quantity) < quantity) {
      return next(
        new AppError(
          `Insufficient stock for this variant (available: ${item.variant.quantity})`,
          400,
        ),
      );
    }
  } else if (item.product) {
    if (Number(item.product.quantity) < quantity) {
      return next(
        new AppError(
          `Insufficient stock (available: ${item.product.quantity})`,
          400,
        ),
      );
    }
  }

  item.quantity = quantity;
  await item.save();

  res.json({ status: "success", data: { item } });
});

exports.remove = catchAsync(async (req, res, next) => {
  const item = await CartItem.findOne({
    where: { id: req.params.id, user_id: req.user.id },
  });
  if (!item) return next(new AppError("Not found", 404));
  await item.destroy();
  res.json({ status: "success" });
});
