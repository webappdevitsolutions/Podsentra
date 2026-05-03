const express = require("express");
const { body, param } = require("express-validator");
const {
  createOrder,
  verifyRazorpayPayment,
  myOrders,
  getAllOrders,
  updateOrderStatus
} = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/auth");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

router.post(
  "/",
  protect,
  [
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.productId").isMongoId().withMessage("Valid product ID required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("shippingAddress.fullName").trim().notEmpty().withMessage("Full name is required"),
    body("shippingAddress.email").isEmail().withMessage("Valid email is required"),
    body("shippingAddress.address").trim().notEmpty().withMessage("Address is required"),
    body("shippingAddress.city").trim().notEmpty().withMessage("City is required"),
    body("shippingAddress.zip").trim().notEmpty().withMessage("ZIP is required"),
    body("paymentMethod").isIn(["cod", "razorpay"]).withMessage("Invalid payment method")
  ],
  validateRequest,
  createOrder
);

router.post(
  "/verify-payment",
  protect,
  [
    body("orderId").isMongoId().withMessage("Valid order ID is required"),
    body("razorpayOrderId").notEmpty().withMessage("Razorpay order ID required"),
    body("razorpayPaymentId").notEmpty().withMessage("Razorpay payment ID required"),
    body("razorpaySignature").notEmpty().withMessage("Razorpay signature required")
  ],
  validateRequest,
  verifyRazorpayPayment
);

router.get("/my", protect, myOrders);
router.get("/", protect, adminOnly, getAllOrders);
router.patch(
  "/:id/status",
  protect,
  adminOnly,
  [
    param("id").isMongoId().withMessage("Invalid order ID"),
    body("status").isIn(["pending", "paid", "shipped", "delivered", "cancelled"]).withMessage("Invalid status")
  ],
  validateRequest,
  updateOrderStatus
);

module.exports = router;
