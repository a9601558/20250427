"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userRoutes_1 = __importDefault(require("./userRoutes"));
const questionSetRoutes_1 = __importDefault(require("./questionSetRoutes"));
const questionRoutes_1 = __importDefault(require("./questionRoutes"));
const purchaseRoutes_1 = __importDefault(require("./purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./homepageRoutes"));
const userProgressRoutes_1 = __importDefault(require("./userProgressRoutes"));
const router = express_1.default.Router();
// 挂载各个路由
router.use('/users', userRoutes_1.default);
router.use('/question-sets', questionSetRoutes_1.default);
router.use('/questions', questionRoutes_1.default);
router.use('/purchases', purchaseRoutes_1.default);
router.use('/redeem-codes', redeemCodeRoutes_1.default);
router.use('/homepage', homepageRoutes_1.default);
router.use('/user-progress', userProgressRoutes_1.default);
exports.default = router;
