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
const wrongAnswerController = __importStar(require("../controllers/wrongAnswerController"));
const auth_1 = require("../middlewares/auth");
const router = express_1.default.Router();
// 所有路由都需要身份验证
router.use(auth_1.authenticateJwt);
// 获取用户的所有错题记录
router.get('/', wrongAnswerController.getWrongAnswers);
// 保存错题记录
router.post('/', wrongAnswerController.saveWrongAnswer);
// 删除错题记录
router.delete('/:id', wrongAnswerController.deleteWrongAnswer);
// 更新错题备注
router.patch('/:id', wrongAnswerController.updateMemo);
// 标记错题为已掌握
router.post('/:id/mastered', wrongAnswerController.markAsMastered);
// 批量删除错题
router.post('/bulk-delete', wrongAnswerController.bulkDeleteWrongAnswers);
// 获取题库下的错题
router.get('/by-question-set/:questionSetId', wrongAnswerController.getWrongAnswersByQuestionSet);
exports.default = router;
