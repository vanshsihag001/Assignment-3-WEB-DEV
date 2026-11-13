# Inventory and Data Management System

**Assignment 3 – Web Dev III (Unit 3, CO3)**
**Author:** Vansh Sihag

A RESTful backend for managing a store/warehouse product catalogue, built with
**Node.js, Express.js, MongoDB and Mongoose** (plus `dotenv`). No boilerplates or admin panels used.

## Features
- Mongoose schema with field-level validation (required, min/max, regex, integer checks, unique SKU)
- Virtual `stockValue` field (`price × quantity`)
- Full CRUD for products
- Filtering, sorting and pagination through query strings
- Atomic stock increments/decrements (restock / sale) that can never push stock below zero
- Low-stock alert report and category-wise summary using a MongoDB aggregation pipeline
- Input-validation middleware and centralized error handling
- Environment configuration via `dotenv`

## Setup
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run seed              # optional: load 12 sample products
npm start                 # or: npm run dev
```
Requires Node.js 18+ and a running MongoDB (local, or an Atlas URI in `MONGO_URI`).

## Project structure
```
server.js                      entry point (loads env, connects DB, starts server)
src/
  app.js                       express app, routes, error middleware
  seed.js                      sample data loader
  config/db.js                 mongoose connection
  models/Product.js            schema + validation + virtuals
  controllers/productController.js
  routes/productRoutes.js
  middleware/validate.js       body / id / stock validation
  middleware/errorHandler.js   centralized error handling
  utils/                       AppError, asyncHandler
```

## API Endpoints
| Method | Endpoint | Description |
|-------:|----------|-------------|
| POST   | `/api/products` | Create product (201) |
| GET    | `/api/products` | List with filter / sort / pagination |
| GET    | `/api/products/:id` | Get one product |
| PUT    | `/api/products/:id` | Update details and/or quantity (partial update allowed) |
| PATCH  | `/api/products/:id/stock` | Restock / sale: `{ "change": 10 }` or `{ "change": -3 }` |
| DELETE | `/api/products/:id` | Delete product |
| GET    | `/api/products/low-stock` | Products where `quantity <= reorderLevel` |
| GET    | `/api/products/summary` | Aggregation: totals per category |

### Query parameters for `GET /api/products`
| Param | Example | Meaning |
|-------|---------|---------|
| `category` | `?category=Furniture` | exact match, case-insensitive |
| `supplier` | `?supplier=ikea` | partial match |
| `search` | `?search=pen` | name contains |
| `minPrice` / `maxPrice` | `?minPrice=100&maxPrice=5000` | price range |
| `inStock` | `?inStock=true` | `true` = quantity > 0, `false` = out of stock |
| `sort` | `?sort=-price,name` | comma separated, `-` = descending |
| `page` / `limit` | `?page=2&limit=5` | pagination (limit max 100, default 10) |

### Sample requests
```http
POST /api/products
{ "name": "Gel Pen Pack of 15", "sku": "STNY-PN-713", "category": "Stationery",
  "price": 120, "quantity": 40, "reorderLevel": 20, "supplier": "Cello Pens" }

PUT /api/products/<id>
{ "name": "Gel Pen Pack of 15", "sku": "STNY-PN-713", "category": "Stationery", "price": 140, "quantity": 60 }

PATCH /api/products/<id>/stock
{ "change": 10 }

DELETE /api/products/<id>
-> { "message": "Product deleted", "id": "<id>" }
```

### Error format
```json
{ "message": "Validation failed", "errors": [{ "field": "price", "message": "Price cannot be negative" }] }
```
| Status | When |
|-------:|------|
| 400 | validation error, bad id, bad query param, insufficient stock, malformed JSON |
| 404 | product or route not found |
| 409 | duplicate SKU |
| 500 | unexpected server error |
