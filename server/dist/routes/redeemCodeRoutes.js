"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const redeemCodeController_1 = require("../controllers/redeemCodeController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// @desc    Generate redeem codes
// @route   POST /api/redeem-codes/generate
// @access  Private/Admin
router.post('/generate', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.generateRedeemCodes);
// @desc    Get all redeem codes
// @route   GET /api/redeem-codes
// @access  Private/Admin
router.get('/', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.getRedeemCodes);
// @desc    Redeem a code
// @route   POST /api/redeem-codes/redeem
// @access  Private
router.post('/redeem', authMiddleware_1.protect, redeemCodeController_1.redeemCode);
// @desc    Delete a redeem code
// @route   DELETE /api/redeem-codes/:id
// @access  Private/Admin
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.deleteRedeemCode);
// @desc    Get user's redeemed codes
// @route   GET /api/redeem-codes/user
// @access  Private
router.get('/user', authMiddleware_1.protect, redeemCodeController_1.getUserRedeemCodes);
// @desc    Fix redeem code question set association
// @route   PUT /api/redeem-codes/:id/fix-question-set
// @access  Private/Admin
router.put('/:id/fix-question-set', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.fixRedeemCodeQuestionSet);
// @desc    Debug redeem codes and question sets
// @route   GET /api/redeem-codes/debug
// @access  Private/Admin
router.get('/debug', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.debugRedeemCodes);
// @desc    Batch fix redeem codes
// @route   POST /api/redeem-codes/batch-fix
// @access  Private/Admin
router.post('/batch-fix', authMiddleware_1.protect, authMiddleware_1.admin, redeemCodeController_1.batchFixRedeemCodes);
exports.default = router;
