"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const questionSetController_1 = require("../controllers/questionSetController");
const questionsUploadController_1 = require("../controllers/questionsUploadController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Public routes
router.get('/', questionSetController_1.getAllQuestionSets);
// Admin routes
router.post('/upload', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.uploadQuestionSets);
// File upload route
router.post('/upload/file', authMiddleware_1.protect, authMiddleware_1.admin, questionsUploadController_1.upload.single('file'), questionsUploadController_1.uploadQuestionSetFile);
// Protected routes that use ID parameters
router.post('/:id/progress', authMiddleware_1.protect, questionSetController_1.saveProgress);
// Admin routes with ID parameters
router.put('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.updateQuestionSet);
router.delete('/:id', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.deleteQuestionSet);
// Base routes
router.post('/', authMiddleware_1.protect, authMiddleware_1.admin, questionSetController_1.createQuestionSet);
router.get('/:id', questionSetController_1.getQuestionSetById);
exports.default = router;
