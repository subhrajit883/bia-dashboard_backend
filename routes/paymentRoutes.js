import express from "express";
import protect from "../middlewares/authMiddleware.js";
import authorize from "../middlewares/roleMiddleware.js";
import { createPayment, getPayments, getPaymentById, updatePayment, deletePayment } from "../controllers/paymentController.js";

const router = express.Router();
router.use(protect, authorize("admin", "accounts"));

router.route("/")
  .post(createPayment)
  .get(getPayments);

router.route("/:id")
  .get(getPaymentById)
  .put(updatePayment)
  .delete(deletePayment);

export default router;

