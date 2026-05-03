const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const Product = require("../models/Product");

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
    : null;

const SHIPPING_FEE = 40;
const TAX_RATE = 0.05;

const buildOrderItems = async (items) => {
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const normalizedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(String(item.productId));
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    if (product.stock < item.quantity) {
      const err = new Error(`Insufficient stock for ${product.name}`);
      err.statusCode = 400;
      throw err;
    }

    const lineTotal = Number((product.price * item.quantity).toFixed(2));
    subtotal += lineTotal;

    normalizedItems.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: item.quantity,
      lineTotal
    });
  }

  subtotal = Number(subtotal.toFixed(2));
  const tax = Number((subtotal * TAX_RATE).toFixed(2));
  const shipping = subtotal > 500 ? 0 : SHIPPING_FEE;
  const total = Number((subtotal + tax + shipping).toFixed(2));

  return { normalizedItems, subtotal, tax, shipping, total };
};

const reduceStock = async (items) => {
  const ops = items.map((item) => ({
    updateOne: {
      filter: { _id: item.product },
      update: { $inc: { stock: -item.quantity } }
    }
  }));
  await Product.bulkWrite(ops);
};

const createOrder = async (req, res, next) => {
  try {
    const { items, shippingAddress, paymentMethod = "cod" } = req.body;

    const { normalizedItems, subtotal, tax, shipping, total } = await buildOrderItems(items);

    const orderData = {
      user: req.user._id,
      items: normalizedItems,
      shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      status: "pending",
      totals: { subtotal, tax, shipping, total }
    };

    if (paymentMethod === "razorpay") {
      if (!razorpay) {
        return res.status(503).json({
          success: false,
          message: "Razorpay credentials are missing. Configure RAZORPAY_* in backend/.env."
        });
      }

      const rpOrder = await razorpay.orders.create({
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: `order_${Date.now()}`
      });

      orderData.razorpay = { orderId: rpOrder.id };
      const order = await Order.create(orderData);

      return res.status(201).json({
        success: true,
        message: "Order created. Complete payment.",
        order,
        razorpayOrder: {
          id: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
          key: process.env.RAZORPAY_KEY_ID
        }
      });
    }

    const order = await Order.create(orderData);
    await reduceStock(order.items);

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order
    });
  } catch (error) {
    next(error);
  }
};

const verifyRazorpayPayment = async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        success: false,
        message: "Razorpay verification is unavailable. Missing RAZORPAY_KEY_SECRET."
      });
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      order.paymentStatus = "failed";
      await order.save();
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    if (order.paymentStatus === "paid") {
      return res.json({ success: true, message: "Payment already verified", order });
    }

    order.paymentStatus = "paid";
    order.status = "paid";
    order.paidAt = new Date();
    order.razorpay = {
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature
    };
    await order.save();

    await reduceStock(order.items);

    res.json({ success: true, message: "Payment verified", order });
  } catch (error) {
    next(error);
  }
};

const myOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

const getAllOrders = async (_req, res, next) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    next(error);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.status = status;
    if (status === "paid") {
      order.paymentStatus = "paid";
    }
    await order.save();

    res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyRazorpayPayment,
  myOrders,
  getAllOrders,
  updateOrderStatus
};
