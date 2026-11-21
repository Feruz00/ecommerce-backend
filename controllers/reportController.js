"use strict";

const { Op, fn, col, literal } = require("sequelize");
const ExcelJS = require("exceljs");

const { Order, OrderItem, Product, User } = require("../models");
const catchAsync = require("../utils/catchAsync");

// ============================================================
// HELPERS
// ============================================================

const language = (req) => {
  const header = String(req.headers["accept-language"] || "en")
    .slice(0, 2)
    .toLowerCase();

  return ["en", "tm", "ru"].includes(header) ? header : "en";
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const parseDate = (value, endOfDay = false) => {
  if (!value) return null;

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return null;

  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }

  return d;
};

const getProductName = (product, locale = "en") => {
  if (!product) return "—";

  const translations =
    typeof product.translations === "string"
      ? JSON.parse(product.translations || "{}")
      : product.translations || {};

  return (
    translations?.[locale]?.name ||
    translations?.en?.name ||
    translations?.ru?.name ||
    translations?.tm?.name ||
    product.name ||
    product.sku ||
    "—"
  );
};

// Prefer the order item snapshot to preserve historical product names.
const getOrderItemName = (item, locale = "en") => {
  return (
    item.product_name ||
    getProductName(item.product, locale) ||
    item.product_sku ||
    "—"
  );
};

const getCustomerName = (user, shippingAddress = {}) => {
  return (
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    shippingAddress?.full_name ||
    "—"
  );
};

const getCustomerPhone = (user, shippingAddress = {}) => {
  return user?.phone || shippingAddress?.phone || "";
};

const getSelectedAttributes = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }

  return JSON.stringify(value);
};

/**
 * Build common order filters.
 */
function buildOrderWhere(query) {
  const where = {};

  const start = parseDate(query.start_date || query.from);
  const end = parseDate(query.end_date || query.to, true);

  if (start || end) {
    where.created_at = {};

    if (start) where.created_at[Op.gte] = start;
    if (end) where.created_at[Op.lte] = end;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.payment_status) {
    where.payment_status = query.payment_status;
  }

  if (query.payment_method) {
    where.payment_method = query.payment_method;
  }

  return where;
}

/**
 * Exclude cancelled orders without overwriting selected filters.
 *
 * For example:
 * status=delivered
 * becomes:
 * status=delivered AND status!=cancelled
 */
function getRevenueWhere(where) {
  return {
    [Op.and]: [
      where,
      {
        status: {
          [Op.ne]: "cancelled",
        },
      },
    ],
  };
}

// ============================================================
// GET /api/reports/summary
// ============================================================

exports.getSummary = catchAsync(async (req, res) => {
  const where = buildOrderWhere(req.query);
  const revenueWhere = getRevenueWhere(where);

  const [totalOrders, revenueResult, statusGroups, paymentGroups, itemsResult] =
    await Promise.all([
      Order.count({
        where,
      }),

      Order.findOne({
        where: revenueWhere,
        attributes: [
          [fn("COALESCE", fn("SUM", col("Order.total")), 0), "total_revenue"],
          [fn("COALESCE", fn("AVG", col("Order.total")), 0), "avg_order_value"],
          [fn("COALESCE", fn("SUM", col("Order.subtotal")), 0), "subtotal"],
          [
            fn("COALESCE", fn("SUM", col("Order.shipping_cost")), 0),
            "shipping",
          ],
          [fn("COALESCE", fn("SUM", col("Order.discount")), 0), "discount"],
        ],
        raw: true,
      }),

      Order.findAll({
        where,
        attributes: ["status", [fn("COUNT", col("Order.id")), "count"]],
        group: ["Order.status"],
        raw: true,
      }),

      Order.findAll({
        where,
        attributes: ["payment_status", [fn("COUNT", col("Order.id")), "count"]],
        group: ["Order.payment_status"],
        raw: true,
      }),

      OrderItem.findOne({
        attributes: [
          [
            fn("COALESCE", fn("SUM", col("OrderItem.quantity")), 0),
            "items_sold",
          ],
          [
            fn("COALESCE", fn("SUM", col("OrderItem.total")), 0),
            "items_revenue",
          ],
        ],
        include: [
          {
            model: Order,
            as: "order",
            attributes: [],
            where: revenueWhere,
            required: true,
          },
        ],
        raw: true,
      }),
    ]);

  const byStatus = {};
  statusGroups.forEach((row) => {
    byStatus[row.status] = toNumber(row.count);
  });

  const byPayment = {};
  paymentGroups.forEach((row) => {
    byPayment[row.payment_status] = toNumber(row.count);
  });

  res.json({
    status: "success",
    data: {
      summary: {
        total_orders: totalOrders,
        total_revenue: toNumber(revenueResult?.total_revenue),
        avg_order_value: toNumber(revenueResult?.avg_order_value),
        subtotal: toNumber(revenueResult?.subtotal),
        shipping: toNumber(revenueResult?.shipping),
        discount: toNumber(revenueResult?.discount),
        items_sold: toNumber(itemsResult?.items_sold),
        items_revenue: toNumber(itemsResult?.items_revenue),
        by_status: byStatus,
        by_payment: byPayment,
      },
    },
  });
});

// ============================================================
// GET /api/reports/orders
// ============================================================

exports.getOrders = catchAsync(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

  const where = buildOrderWhere(req.query);

  const { count, rows } = await Order.findAndCountAll({
    where,
    distinct: true,

    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "first_name", "last_name", "username", "phone"],
        required: false,
      },
      {
        model: OrderItem,
        as: "items",
        attributes: [
          "id",
          "product_id",
          "variant_id",
          "product_name",
          "product_sku",
          "price",
          "quantity",
          "total",
          "selected_attributes",
        ],
      },
    ],

    order: [["created_at", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });

  const orders = rows.map((order) => {
    const o = order.toJSON();

    o.customer_name = getCustomerName(o.user, o.shipping_address);

    o.items_count = (o.items || []).reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0,
    );

    return o;
  });

  res.json({
    status: "success",
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit) || 1,
    data: {
      orders,
    },
  });
});

// ============================================================
// GET /api/reports/top-products
// ============================================================

exports.getTopProducts = catchAsync(async (req, res) => {
  const locale = language(req);
  const where = getRevenueWhere(buildOrderWhere(req.query));

  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

  const rows = await OrderItem.findAll({
    attributes: [
      "product_id",
      [fn("SUM", col("OrderItem.quantity")), "quantity_sold"],
      [fn("SUM", col("OrderItem.total")), "revenue"],
      [fn("COUNT", col("OrderItem.id")), "line_count"],
    ],

    include: [
      {
        model: Order,
        as: "order",
        attributes: [],
        where,
        required: true,
      },
      {
        model: Product,
        as: "product",
        attributes: ["id", "sku", "slug", "translations", "price"],
        required: false,
      },
    ],

    group: ["OrderItem.product_id", "product.id"],
    order: [[literal("revenue"), "DESC"]],
    limit,
    subQuery: false,
  });

  const products = rows.map((row) => {
    const r = row.toJSON ? row.toJSON() : row;

    return {
      product_id: r.product_id,
      sku: r.product?.sku || null,
      name: getProductName(r.product, locale),
      quantity_sold: toNumber(r.quantity_sold),
      revenue: toNumber(r.revenue),
      line_count: toNumber(r.line_count),
    };
  });

  res.json({
    status: "success",
    data: {
      products,
    },
  });
});

// ============================================================
// GET /api/reports/daily
// ============================================================

exports.getDaily = catchAsync(async (req, res) => {
  const baseWhere = buildOrderWhere(req.query);

  // Default: last 30 days, only when no date filter is supplied.
  if (!baseWhere.created_at) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date();
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    baseWhere.created_at = {
      [Op.gte]: start,
      [Op.lte]: end,
    };
  }

  const where = getRevenueWhere(baseWhere);

  const rows = await Order.findAll({
    where,

    attributes: [
      [fn("DATE", col("Order.created_at")), "date"],
      [fn("COUNT", col("Order.id")), "orders"],
      [fn("COALESCE", fn("SUM", col("Order.total")), 0), "revenue"],
    ],

    group: [fn("DATE", col("Order.created_at"))],
    order: [[fn("DATE", col("Order.created_at")), "ASC"]],
    raw: true,
  });

  const daily = rows.map((row) => ({
    date: row.date,
    orders: toNumber(row.orders),
    revenue: toNumber(row.revenue),
  }));

  res.json({
    status: "success",
    data: {
      daily,
    },
  });
});

// ============================================================
// GET /api/reports/export
// CSV EXPORT
// ============================================================

exports.exportOrders = catchAsync(async (req, res) => {
  const where = buildOrderWhere(req.query);
  const maxRows = 5000;

  const rows = await Order.findAll({
    where,

    include: [
      {
        model: User,
        as: "user",
        attributes: ["first_name", "last_name", "username", "phone"],
        required: false,
      },
      {
        model: OrderItem,
        as: "items",
        attributes: [
          "product_name",
          "product_sku",
          "price",
          "quantity",
          "total",
          "selected_attributes",
        ],
      },
    ],

    order: [["created_at", "DESC"]],
    limit: maxRows,
  });

  const escapeCsv = (value) => {
    if (value == null) return "";

    let s = String(value);

    // Prevent spreadsheet formula injection.
    if (/^[=+\-@]/.test(s)) {
      s = `'${s}`;
    }

    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }

    return s;
  };

  const headers = [
    "Order Number",
    "Date",
    "Customer",
    "Phone",
    "Status",
    "Payment Status",
    "Payment Method",
    "Items",
    "Subtotal",
    "Shipping",
    "Discount",
    "Total",
    "City",
    "Note",
  ];

  const lines = [headers.map(escapeCsv).join(",")];

  for (const order of rows) {
    const o = order.toJSON();

    const customer = getCustomerName(o.user, o.shipping_address);
    const phone = getCustomerPhone(o.user, o.shipping_address);

    const itemsCount = (o.items || []).reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0,
    );

    const city = o.shipping_address?.city || "";

    lines.push(
      [
        o.order_number,
        o.created_at ? new Date(o.created_at).toISOString().slice(0, 19) : "",
        customer,
        phone,
        o.status,
        o.payment_status,
        o.payment_method,
        itemsCount,
        o.subtotal,
        o.shipping_cost,
        o.discount,
        o.total,
        city,
        o.note || "",
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  // UTF-8 BOM for Excel (Turkmen / Russian support).
  const csv = "\uFEFF" + lines.join("\r\n");

  const filename = `orders-report-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.send(csv);
});

// ============================================================
// GET /api/reports/export/excel
// EXCEL EXPORT
// ============================================================

exports.exportOrdersExcel = catchAsync(async (req, res) => {
  const locale = language(req);
  const where = buildOrderWhere(req.query);
  const maxRows = 5000;

  const orders = await Order.findAll({
    where,

    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "first_name", "last_name", "username", "phone"],
        required: false,
      },
      {
        model: OrderItem,
        as: "items",
        attributes: [
          "id",
          "product_id",
          "variant_id",
          "product_name",
          "product_sku",
          "price",
          "quantity",
          "total",
          "selected_attributes",
        ],
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "sku", "slug", "translations"],
            required: false,
          },
        ],
      },
    ],

    order: [["created_at", "DESC"]],
    limit: maxRows,
  });

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "TechStore";
  workbook.subject = "Orders report";
  workbook.title = "Orders Report";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Orders", {
    views: [
      {
        state: "frozen",
        ySplit: 1,
      },
    ],
  });

  worksheet.columns = [
    { header: "Order Number", key: "orderNumber", width: 20 },
    { header: "Date", key: "date", width: 22 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Username", key: "username", width: 22 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Product", key: "product", width: 35 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Variant / Attributes", key: "variant", width: 35 },
    { header: "Quantity", key: "quantity", width: 12 },
    { header: "Price", key: "price", width: 16 },
    { header: "Item Total", key: "itemTotal", width: 16 },
    { header: "Subtotal", key: "subtotal", width: 16 },
    { header: "Shipping", key: "shipping", width: 16 },
    { header: "Discount", key: "discount", width: 16 },
    { header: "Order Total", key: "total", width: 16 },
    { header: "Status", key: "status", width: 18 },
    { header: "Payment Method", key: "paymentMethod", width: 20 },
    { header: "Payment Status", key: "paymentStatus", width: 20 },
    { header: "City", key: "city", width: 20 },
    { header: "Note", key: "note", width: 35 },
  ];

  for (const order of orders) {
    const o = order.toJSON();

    const items = o.items || [];

    const customer = getCustomerName(o.user, o.shipping_address);
    const phone = getCustomerPhone(o.user, o.shipping_address);

    const commonOrderData = {
      orderNumber: o.order_number || "",
      date: o.created_at ? new Date(o.created_at) : null,
      customer,
      username: o.user?.username || "",
      phone,
      subtotal: toNumber(o.subtotal),
      shipping: toNumber(o.shipping_cost),
      discount: toNumber(o.discount),
      total: toNumber(o.total),
      status: o.status || "",
      paymentMethod: o.payment_method || "",
      paymentStatus: o.payment_status || "",
      city: o.shipping_address?.city || "",
      note: o.note || "",
    };

    // Keep orders even when they do not have any items.
    if (!items.length) {
      worksheet.addRow({
        ...commonOrderData,
      });

      continue;
    }

    items.forEach((item, index) => {
      const row = {
        // Order information appears only on the first item row.
        ...(index === 0 ? commonOrderData : {}),

        product: getOrderItemName(item, locale),
        sku: item.product_sku || item.product?.sku || "",
        variant: getSelectedAttributes(item.selected_attributes),
        quantity: toNumber(item.quantity),
        price: toNumber(item.price),
        itemTotal: toNumber(item.total),

        // Avoid repeating order totals for every product row.
        subtotal: index === 0 ? commonOrderData.subtotal : null,
        shipping: index === 0 ? commonOrderData.shipping : null,
        discount: index === 0 ? commonOrderData.discount : null,
        total: index === 0 ? commonOrderData.total : null,
      };

      worksheet.addRow(row);
    });
  }

  // ----------------------------------------------------------
  // HEADER STYLE
  // ----------------------------------------------------------

  const header = worksheet.getRow(1);

  header.height = 30;

  header.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 11,
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF312E81" },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    cell.border = {
      bottom: {
        style: "medium",
        color: { argb: "FF6366F1" },
      },
    };
  });

  // ----------------------------------------------------------
  // DATA STYLE AND FORMATTING
  // ----------------------------------------------------------

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    row.height = 23;

    row.alignment = {
      vertical: "middle",
    };

    // Date.
    row.getCell("date").numFmt = "yyyy-mm-dd hh:mm";

    // Numeric values.
    ["price", "itemTotal", "subtotal", "shipping", "discount", "total"].forEach(
      (key) => {
        row.getCell(key).numFmt = '#,##0.00 "TMT"';
      },
    );

    row.getCell("quantity").numFmt = "#,##0";

    // Alternating row background.
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }

    // Highlight order number.
    row.getCell("orderNumber").font = {
      bold: true,
      color: { argb: "FF312E81" },
    };

    // Highlight order total.
    row.getCell("total").font = {
      bold: true,
      color: { argb: "FF047857" },
    };

    // Wrap product attributes and notes.
    row.getCell("variant").alignment = {
      vertical: "middle",
      wrapText: true,
    };

    row.getCell("note").alignment = {
      vertical: "middle",
      wrapText: true,
    };
  });

  // ----------------------------------------------------------
  // FILTER AND FOOTER
  // ----------------------------------------------------------

  if (worksheet.rowCount > 1) {
    worksheet.autoFilter = {
      from: "A1",
      to: "T1",
    };
  }

  worksheet.properties.defaultRowHeight = 22;

  // ----------------------------------------------------------
  // RESPONSE
  // ----------------------------------------------------------

  const filename = `orders-report-${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  res.setHeader("Cache-Control", "no-store");

  await workbook.xlsx.write(res);
  res.end();
});
