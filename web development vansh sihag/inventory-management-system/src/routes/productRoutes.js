const express = require('express');
const ctrl = require('../controllers/productController');
const {
  validateProductBody,
  validateStockChange,
  validateObjectId,
} = require('../middleware/validate');

const router = express.Router();

// Rejects malformed ids before any handler runs
router.param('id', validateObjectId);

// NOTE: fixed paths must be declared BEFORE "/:id" or they'd be treated as ids
router.get('/low-stock', ctrl.getLowStock);
router.get('/summary', ctrl.getCategorySummary);

router.route('/')
  .get(ctrl.getProducts)
  .post(validateProductBody(true), ctrl.createProduct);

router.route('/:id')
  .get(ctrl.getProduct)
  .put(validateProductBody(false), ctrl.updateProduct)
  .delete(ctrl.deleteProduct);

router.patch('/:id/stock', validateStockChange, ctrl.adjustStock);

module.exports = router;
