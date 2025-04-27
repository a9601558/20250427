// 题库显示问题修复脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('开始修复题库显示问题...');

// 修复服务器端 questionController.ts 文件
const fixQuestionController = () => {
  try {
    const controllerPath = path.join(__dirname, 'server', 'src', 'controllers', 'questionController.ts');
    
    // 检查文件是否存在
    if (!fs.existsSync(controllerPath)) {
      console.error(`❌ 文件不存在: ${controllerPath}`);
      return false;
    }
    
    // 读取文件内容
    let content = fs.readFileSync(controllerPath, 'utf8');
    
    // 检查是否已经导入 Option 模型
    if (!content.includes('import Option from')) {
      console.log('添加 Option 模型导入...');
      content = content.replace(
        'import { Op } from \'sequelize\';',
        'import { Op } from \'sequelize\';\nimport Option from \'../models/Option\';'
      );
    }
    
    // 更新 getAllQuestionSets 方法
    console.log('更新 getAllQuestionSets 方法...');
    content = content.replace(
      /const questionSets = await QuestionSet\.findAll\(\{[^}]*include: \[\{ model: Question, as: 'questions' \}\][^}]*\}\);/,
      `const questionSets = await QuestionSet.findAll({
      include: [{ 
        model: Question, 
        as: 'questions',
        include: [{ model: Option, as: 'options' }]
      }]
    });`
    );
    
    // 更新 getQuestionSetById 方法
    console.log('更新 getQuestionSetById 方法...');
    content = content.replace(
      /const questionSet = await QuestionSet\.findByPk\(req\.params\.id, \{[^}]*include: \[\{ model: Question, as: 'questions' \}\][^}]*\}\);/,
      `const questionSet = await QuestionSet.findByPk(req.params.id, {
      include: [{ 
        model: Question, 
        as: 'questions',
        include: [{ model: Option, as: 'options' }]
      }]
    });`
    );
    
    // 写入文件
    fs.writeFileSync(controllerPath, content, 'utf8');
    console.log('✅ 已修复 questionController.ts');
    return true;
  } catch (error) {
    console.error('❌ 修复 questionController.ts 失败:', error);
    return false;
  }
};

// 修复 QuizPage.tsx 文件，确保正确处理题目和选项
const fixQuizPage = () => {
  try {
    const quizPagePath = path.join(__dirname, 'src', 'components', 'QuizPage.tsx');
    
    // 检查文件是否存在
    if (!fs.existsSync(quizPagePath)) {
      console.error(`❌ 文件不存在: ${quizPagePath}`);
      return false;
    }
    
    // 读取文件内容
    let content = fs.readFileSync(quizPagePath, 'utf8');
    
    // 查找数据加载部分并添加调试信息
    console.log('更新 QuizPage.tsx 中的数据处理...');
    const fetchQuestionDataIndex = content.indexOf('const fetchQuestionSet = async () => {');
    
    if (fetchQuestionDataIndex !== -1) {
      // 查找获取题库数据后的处理部分
      const startStr = 'if (response.success && response.data) {';
      const startIndex = content.indexOf(startStr, fetchQuestionDataIndex);
      
      if (startIndex !== -1) {
        const endStr = 'setQuestions(response.data.questions);';
        const endIndex = content.indexOf(endStr, startIndex);
        
        if (endIndex !== -1) {
          // 将原始代码替换为更新后的代码
          const beforeCode = content.substring(0, startIndex + startStr.length);
          const afterCode = content.substring(endIndex + endStr.length);
          
          // 新的数据处理代码，添加更多日志和错误处理
          const newCode = `
          setQuestionSet(response.data);
          
          // 检查题目数据
          if (response.data.questions && response.data.questions.length > 0) {
            console.log("获取到题目:", response.data.questions.length);
            
            // 检查并处理题目选项
            const processedQuestions = response.data.questions.map(q => {
              // 确保选项存在
              if (!q.options || !Array.isArray(q.options)) {
                console.warn("题目缺少选项:", q.id);
                q.options = [];
              }
              
              // 处理选项
              const processedOptions = q.options.map(opt => ({
                id: opt.optionIndex,
                text: opt.text
              }));
              
              // 处理正确答案
              let correctAnswer;
              if (q.questionType === 'single') {
                const correctOpt = q.options.find(o => o.isCorrect);
                correctAnswer = correctOpt ? correctOpt.optionIndex : '';
              } else {
                correctAnswer = q.options
                  .filter(o => o.isCorrect)
                  .map(o => o.optionIndex);
              }
              
              return {
                ...q,
                options: processedOptions,
                correctAnswer
              };
            });
            
            setQuestions(processedQuestions);
          } else {
            console.error("题库中没有题目");
            setError('此题库不包含任何题目');
          }`;
          
          const updatedContent = beforeCode + newCode + afterCode;
          fs.writeFileSync(quizPagePath, updatedContent, 'utf8');
          console.log('✅ 已修复 QuizPage.tsx');
          return true;
        }
      }
    }
    
    console.error('❌ 无法在 QuizPage.tsx 中找到正确的代码位置');
    return false;
  } catch (error) {
    console.error('❌ 修复 QuizPage.tsx 失败:', error);
    return false;
  }
};

// 修复 models 索引文件，确保关联正确
const fixModelsIndex = () => {
  try {
    const modelsIndexPath = path.join(__dirname, 'server', 'src', 'models', 'index.ts');
    
    // 检查文件是否存在
    if (!fs.existsSync(modelsIndexPath)) {
      console.error(`❌ 文件不存在: ${modelsIndexPath}`);
      return false;
    }
    
    // 读取文件内容
    let content = fs.readFileSync(modelsIndexPath, 'utf8');
    
    // 确保关联正确
    if (!content.includes('Question.hasMany(Option')) {
      console.log('添加 Question 和 Option 关联...');
      
      // 查找关联代码块
      const associationBlockStart = 'QuestionSet.hasMany(Question';
      const insertIndex = content.indexOf(associationBlockStart);
      
      if (insertIndex !== -1) {
        // 在现有关联后添加新的关联
        const beforeCode = content.substring(0, insertIndex);
        const afterCode = content.substring(insertIndex);
        
        const updatedContent = beforeCode + `Question.hasMany(Option, {
  foreignKey: 'questionId',
  as: 'options'
});
Option.belongsTo(Question, {
  foreignKey: 'questionId',
  as: 'question'
});

` + afterCode;
        
        fs.writeFileSync(modelsIndexPath, updatedContent, 'utf8');
        console.log('✅ 已修复 models/index.ts');
        return true;
      }
    } else {
      console.log('✅ models/index.ts 关联已正确设置');
      return true;
    }
    
    console.error('❌ 无法在 models/index.ts 中找到正确的插入位置');
    return false;
  } catch (error) {
    console.error('❌ 修复 models/index.ts 失败:', error);
    return false;
  }
};

// 执行修复
const controllerFixed = fixQuestionController();
const quizPageFixed = fixQuizPage();
const modelsFixed = fixModelsIndex();

if (controllerFixed && quizPageFixed && modelsFixed) {
  console.log('✅ 所有修复已完成！');
  console.log('请重启服务器以应用更改。');
  console.log('重启命令: node restart-server.js');
} else {
  console.log('⚠️ 部分修复失败，请检查错误信息');
} 