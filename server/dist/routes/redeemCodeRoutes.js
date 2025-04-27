"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const redeemCodeController_1 = require("../controllers/redeemCodeController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Protected routes
router.post('/redeem', authMiddleware_1.protect, redeemCodeController_1.redeemCode);
// Admin routes
router.get('/', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.getRedeemCodes);
router.post('/generate', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.generateRedeemCodes);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.deleteRedeemCode);
exports.default = router;
