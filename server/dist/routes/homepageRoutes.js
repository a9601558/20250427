"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const homepageController = __importStar(require("../controllers/homepageController"));
// 打印调试信息
console.log('Debug homepage routes:');
console.log('homepageController:', typeof homepageController);
for (const key in homepageController) {
    console.log(`${key}:`, typeof homepageController[key]);
}
const router = express_1.default.Router();
// 获取首页内容
router.get('/content', homepageController.getHomepageContent);
// 更新首页内容（需要管理员权限）
router.put('/content', authMiddleware_1.protect, authMiddleware_1.admin, homepageController.updateHomepageContent);
// 获取精选分类
router.get('/featured-categories', homepageController.getFeaturedCategories);
// 更新精选分类（需要管理员权限）
router.put('/featured-categories', authMiddleware_1.protect, authMiddleware_1.admin, homepageController.updateFeaturedCategories);
// 获取精选题库
router.get('/featured-question-sets', homepageController.getFeaturedQuestionSets);
exports.default = router;
