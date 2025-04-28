"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const purchaseController_1 = require("../controllers/purchaseController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// All purchase routes require authentication
router.use(authMiddleware_1.protect);
// Purchase routes
router.post('/', purchaseController_1.createPurchase);
router.get('/', purchaseController_1.getUserPurchases);
exports.default = router;
