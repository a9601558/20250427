"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProgress = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userProgressSchema = new mongoose_1.default.Schema({
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    questionSetId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'QuestionSet',
        required: true,
    },
    questionId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
    },
    isCorrect: {
        type: Boolean,
        required: true,
    },
    timeSpent: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});
exports.UserProgress = mongoose_1.default.model('UserProgress', userProgressSchema);
