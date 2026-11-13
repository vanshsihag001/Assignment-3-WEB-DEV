const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const SORTABLE = ['name', 'sku', 'category', 'price', 'quantity', 'reorderLevel', 'createdAt', 'updatedAt'];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const asString = (v) => (typeof v === 'string' ? v.trim() : '');

const parseNumberParam = (value, name) => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(n)) {
    throw new AppError(`Query param "${name}" must be a number`, 400);
  }
  return n;
};

// "?sort=-price,name" -> { price: -1, name: 1 }
const buildSort = (sortParam) => {
  const raw = asString(sortParam) || '-createdAt';
  const sort = {};
  raw.split(',').forEach((token) => {
    const t = token.trim();
    if (!t) return;
    const desc = t.startsWith('-');
    const key = desc ? t.slice(1) : t;
    if (!SORTABLE.includes(key)) {
      throw new AppError(`Cannot sort by "${key}". Allowed: ${SORTABLE.join(', ')}`, 400);
    }
    sort[key] = desc ? -1 : 1;
  });
  return sort;
};

// ---------- CREATE ----------
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// ---------- READ ALL (filter / sort / paginate) ----------
exports.getProducts = asyncHandler(async (req, res) => {
  const { category, supplier, search, minPrice, maxPrice, inStock } = req.query;
  const filter = {};

  if (asString(category)) filter.category = new RegExp(`^${escapeRegex(asString(category))}$`, 'i');
  if (asString(supplier)) filter.supplier = new RegExp(escapeRegex(asString(supplier)), 'i');
  if (asString(search)) filter.name = new RegExp(escapeRegex(asString(search)), 'i');

  const min = parseNumberParam(minPrice, 'minPrice');
  const max = parseNumberParam(maxPrice, 'maxPrice');
  if (min !== undefined || max !== undefined) {
    filter.price = {};
    if (min !== undefined) filter.price.$gte = min;
    if (max !== undefined) filter.price.$lte = max;
  }

  if (inStock === 'true') filter.quantity = { $gt: 0 };
  else if (inStock === 'false') filter.quantity = 0;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const sort = buildSort(req.query.sort);

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    total,
    page,
    totalPages: Math.ceil(total / limit),
    count: products.length,
    products,
  });
});

// ---------- READ ONE ----------
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

// ---------- UPDATE (details + stock via PUT) ----------
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!product) throw new AppError('Product not found', 404);
  res.json(product);
});

// ---------- DELETE ----------
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ message: 'Product deleted', id: product.id });
});

// ---------- STOCK ADJUSTMENT (restock / sale) ----------
// PATCH /api/products/:id/stock   { "change": 10 }  or  { "change": -3 }
// Uses a single atomic $inc with a guard so stock can never go negative,
// even when many requests arrive at the same time (no read-modify-write race).
exports.adjustStock = asyncHandler(async (req, res) => {
  const { change } = req.body;
  const filter = { _id: req.params.id };
  if (change < 0) filter.quantity = { $gte: -change };

  const product = await Product.findOneAndUpdate(
    filter,
    { $inc: { quantity: change } },
    { new: true, runValidators: true }
  );

  if (!product) {
    const exists = await Product.exists({ _id: req.params.id });
    if (!exists) throw new AppError('Product not found', 404);
    throw new AppError('Insufficient stock for this sale', 400);
  }

  res.json({ message: 'Stock updated', product });
});

// ---------- REPORT: LOW STOCK ----------
exports.getLowStock = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.find({
    $expr: { $lte: ['$quantity', '$reorderLevel'] },
  }).sort({ quantity: 1 });

  res.json({ count: lowStockItems.length, lowStockItems });
});

// ---------- REPORT: CATEGORY SUMMARY (aggregation) ----------
exports.getCategorySummary = asyncHandler(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        avgPrice: { $avg: '$price' },
      },
    },
    {
      $project: {
        totalItems: 1,
        totalQuantity: 1,
        totalStockValue: 1,
        avgPrice: { $round: ['$avgPrice', 2] },
      },
    },
    { $sort: { totalStockValue: -1 } },
  ]);

  res.json({ categories: summary.length, summary });
});
