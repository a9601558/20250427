import { User } from '../types';

export const MOCK_USERS: User[] = [
  {
    id: 'user1',
    username: 'admin',
    password: 'admin123',
    email: 'admin@example.com',
    isAdmin: true,
    progress: {},
    purchases: [],
    redeemCodes: []
  },
  {
    id: 'user2',
    username: 'test',
    password: 'test123',
    email: 'test@example.com',
    isAdmin: false,
    progress: {},
    purchases: [],
    redeemCodes: []
  },
  {
    id: 'user3',
    username: 'student',
    password: 'student123',
    email: 'student@example.com',
    isAdmin: false,
    progress: {
      '1': {
        completedQuestions: 5,
        totalQuestions: 10,
        correctAnswers: 4,
        lastAccessed: new Date().toISOString()
      }
    },
    purchases: [],
    redeemCodes: []
  },
  {
    id: 'user4',
    username: 'demo',
    password: 'password',
    email: 'demo@example.com',
    isAdmin: false,
    progress: {
      '1': {
        completedQuestions: 10,
        totalQuestions: 10,
        correctAnswers: 8,
        lastAccessed: new Date().toISOString()
      },
      '2': {
        completedQuestions: 3,
        totalQuestions: 5,
        correctAnswers: 2,
        lastAccessed: new Date().toISOString()
      }
    },
    purchases: [
      {
        quizId: '3',
        purchaseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30天前
        expiryDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(), // 150天后
        transactionId: 'tr_demo123456',
        amount: 19.99
      }
    ],
    redeemCodes: []
  },
  {
    id: 'user5',
    username: 'superadmin',
    password: 'super123',
    email: 'superadmin@example.com',
    isAdmin: true,
    progress: {},
    purchases: [],
    redeemCodes: []
  },
  {
    id: 'user6',
    username: 'teacher',
    password: 'teacher123',
    email: 'teacher@example.com',
    isAdmin: true,
    progress: {},
    purchases: [],
    redeemCodes: [
      {
        code: 'TEACHER-2023',
        questionSetId: '4',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        validityDays: 180
      }
    ]
  },
  {
    id: 'user7',
    username: 'premium',
    password: 'premium123',
    email: 'premium@example.com',
    isAdmin: false,
    progress: {},
    purchases: [
      {
        quizId: '2',
        purchaseDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60天前
        expiryDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(), // 120天后
        transactionId: 'tr_premium123',
        amount: 29.99
      },
      {
        quizId: '3',
        purchaseDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10天前
        expiryDate: new Date(Date.now() + 170 * 24 * 60 * 60 * 1000).toISOString(), // 170天后
        transactionId: 'tr_premium456',
        amount: 19.99
      }
    ],
    redeemCodes: []
  },
  {
    id: 'user8',
    username: 'newstudent',
    password: 'newstudent123',
    email: 'newstudent@example.com',
    isAdmin: false,
    progress: {},
    purchases: [],
    redeemCodes: [
      {
        code: 'WELCOME50',
        questionSetId: '2',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        validityDays: 180,
        usedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        usedBy: 'user8'
      }
    ]
  },
  {
    id: 'user9',
    username: 'manager',
    password: 'manager123',
    email: 'manager@example.com',
    isAdmin: true,
    progress: {},
    purchases: [],
    redeemCodes: [
      {
        code: 'STAFF2023',
        questionSetId: '5',
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        validityDays: 180
      },
      {
        code: 'STAFF2024',
        questionSetId: '6',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        validityDays: 180
      }
    ]
  },
  {
    id: 'user10',
    username: 'regular',
    password: 'regular123',
    email: 'regular@example.com',
    isAdmin: false,
    progress: {
      '1': {
        completedQuestions: 8,
        totalQuestions: 10,
        correctAnswers: 7,
        lastAccessed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    },
    purchases: [
      {
        quizId: '4',
        purchaseDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        expiryDate: new Date(Date.now() + 160 * 24 * 60 * 60 * 1000).toISOString(),
        transactionId: 'tr_regular789',
        amount: 24.99
      }
    ],
    redeemCodes: []
  }
]; 