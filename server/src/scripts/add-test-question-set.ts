import { sequelize } from '../config/db';
import QuestionSet from '../models/QuestionSet';
import Question from '../models/Question';
import Option from '../models/Option';
import { v4 as uuidv4 } from 'uuid';

async function addTestQuestionSet() {
  try {
    console.log('开始创建测试题库...');
    
    // 创建一个测试题库
    const questionSet = await QuestionSet.create({
      id: uuidv4(),
      title: '测试题库',
      description: '这是一个用于测试的题库',
      category: '测试分类',
      icon: '📚',
      isPaid: false,
      price: undefined,
      trialQuestions: 0,
      isFeatured: false
    });
    
    console.log(`测试题库创建成功，ID: ${questionSet.id}`);
    
    // 创建一些测试题目
    for (let i = 1; i <= 3; i++) {
      const question = await Question.create({
        id: uuidv4(),
        questionSetId: questionSet.id,
        text: `测试题目 ${i}`,
        explanation: `这是测试题目 ${i} 的解析`,
        questionType: 'single',
        orderIndex: i - 1
      });
      
      console.log(`题目 ${i} 创建成功，ID: ${question.id}`);
      
      // 为每个题目创建选项
      const options = [
        { text: '选项A', isCorrect: i === 1, optionIndex: 'A' },
        { text: '选项B', isCorrect: i === 2, optionIndex: 'B' },
        { text: '选项C', isCorrect: i === 3, optionIndex: 'C' },
        { text: '选项D', isCorrect: false, optionIndex: 'D' }
      ];
      
      for (const option of options) {
        await Option.create({
          id: uuidv4(),
          questionId: question.id,
          text: option.text,
          isCorrect: option.isCorrect,
          optionIndex: option.optionIndex
        });
      }
      
      console.log(`题目 ${i} 的选项创建成功`);
    }
    
    console.log('创建测试题库完成。您现在可以在前端访问这个题库了。');
    process.exit(0);
  } catch (error) {
    console.error('创建测试题库失败:', error);
    process.exit(1);
  }
}

addTestQuestionSet(); 