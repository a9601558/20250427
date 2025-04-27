"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Public routes
router.post('/', userController_1.registerUser);
router.post('/login', userController_1.loginUser);
// Protected routes (requires authentication)
router.get('/profile', authMiddleware_1.protect, userController_1.getUserProfile);
router.put('/profile', authMiddleware_1.protect, userController_1.updateUserProfile);
// Admin routes (requires admin role)
router.get('/', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.getUsers);
router.get('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.getUserById);
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.updateUser);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, userController_1.deleteUser);
exports.default = router;
