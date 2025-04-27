"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const homepageController_1 = require("../controllers/homepageController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 公共路由
router.get('/content', homepageController_1.getHomepageContent);
router.get('/featured-categories', homepageController_1.getFeaturedCategories);
router.get('/featured-question-sets', homepageController_1.getFeaturedQuestionSets);
// 管理员路由
router.put('/content', authMiddleware_1.protect, authMiddleware_1.admin, homepageController_1.updateHomepageContent);
router.put('/featured-categories', authMiddleware_1.protect, authMiddleware_1.admin, homepageController_1.updateFeaturedCategories);
router.put('/featured-question-sets/:id', authMiddleware_1.protect, authMiddleware_1.admin, homepageController_1.updateQuestionSetFeaturedStatus);
exports.default = router;
