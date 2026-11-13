const AppError = require('../utils/AppError');

const ALLOWED_FIELDS = ['name', 'sku', 'category', 'price', 'quantity', 'reorderLevel', 'supplier'];
const REQUIRED_ON_CREATE = ['name', 'sku', 'category', 'price', 'quantity'];
const NUMERIC_FIELDS = ['price', 'quantity', 'reorderLevel'];

const isNumeric = (v) =>
  (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));

// Validates the request body for create (all required fields) and update (partial).
// Unknown fields are stripped so clients cannot inject arbitrary data.
const validateProductBody = (isCreate) => (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return next(new AppError('Request body must be a JSON object', 400));
  }

  const data = {};
  ALLOWED_FIELDS.forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f];
  });

  if (isCreate) {
    const missing = REQUIRED_ON_CREATE.filter((f) => data[f] === undefined || data[f] === '');
    if (missing.length) {
      return next(new AppError(`Missing required field(s): ${missing.join(', ')}`, 400));
    }
  } else if (Object.keys(data).length === 0) {
    return next(new AppError(`Provide at least one field to update: ${ALLOWED_FIELDS.join(', ')}`, 400));
  }

  for (const f of NUMERIC_FIELDS) {
    if (data[f] !== undefined && !isNumeric(data[f])) {
      return next(new AppError(`${f} must be a number`, 400));
    }
  }
  for (const f of ['name', 'sku', 'category', 'supplier']) {
    if (data[f] !== undefined && typeof data[f] !== 'string') {
      return next(new AppError(`${f} must be a string`, 400));
    }
  }

  req.body = data;
  next();
};

const validateStockChange = (req, res, next) => {
  const change = req.body && req.body.change;
  if (typeof change !== 'number' || !Number.isInteger(change) || change === 0) {
    return next(
      new AppError('"change" must be a non-zero integer (positive = restock, negative = sale)', 400)
    );
  }
  next();
};

const validateObjectId = (req, res, next, id) => {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return next(new AppError(`Invalid product id: ${id}`, 400));
  }
  next();
};

module.exports = { validateProductBody, validateStockChange, validateObjectId };
