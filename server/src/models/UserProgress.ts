import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questionSetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QuestionSet',
    required: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
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

export const UserProgress = mongoose.model('UserProgress', userProgressSchema); 