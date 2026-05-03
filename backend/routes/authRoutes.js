const express = require("express");
const { body } = require("express-validator");
const { register, login, adminLogin, me } = require("../controllers/authController");
const validateRequest = require("../middleware/validateRequest");
const { protect } = require("../middleware/auth");

const router = express.Router();

const authValidators = [
  body("email").isEmail().withMessage("Valid email required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
];

router.post(
  "/register",
  [body("name").trim().notEmpty().withMessage("Name is required"), ...authValidators],
  validateRequest,
  register
);

router.post("/login", authValidators, validateRequest, login);
router.post("/admin/login", authValidators, validateRequest, adminLogin);
router.get("/me", protect, me);

module.exports = router;
