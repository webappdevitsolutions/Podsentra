const express = require("express");
const { body, param } = require("express-validator");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require("../controllers/productController");
const validateRequest = require("../middleware/validateRequest");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

const productValidators = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("price").isFloat({ min: 0 }).withMessage("Valid price is required"),
  body("description").trim().notEmpty().withMessage("Description is required"),
  body("image").isURL().withMessage("Valid image URL is required"),
  body("category").trim().notEmpty().withMessage("Category is required"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be 0 or more"),
  body("rating").optional().isFloat({ min: 0, max: 5 }).withMessage("Rating must be between 0 and 5")
];

router.get("/", getProducts);
router.get("/:id", [param("id").isMongoId().withMessage("Invalid product ID")], validateRequest, getProductById);
router.post("/", protect, adminOnly, productValidators, validateRequest, createProduct);
router.put(
  "/:id",
  protect,
  adminOnly,
  [param("id").isMongoId().withMessage("Invalid product ID"), ...productValidators],
  validateRequest,
  updateProduct
);
router.delete(
  "/:id",
  protect,
  adminOnly,
  [param("id").isMongoId().withMessage("Invalid product ID")],
  validateRequest,
  deleteProduct
);

module.exports = router;
