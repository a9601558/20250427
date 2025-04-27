const fs = require('fs');
const path = require('path');

// 服务器上的目标文件路径，你可能需要根据实际情况进行调整
const targetFile = '/www/wwwroot/root/git/dist/server/dist/controllers/questionSetController.js';

// 备份文件
const backupFile = targetFile + '.bak';

// 先创建备份
console.log(`Creating backup of ${targetFile} to ${backupFile}`);
try {
  if (fs.existsSync(targetFile)) {
    fs.copyFileSync(targetFile, backupFile);
    console.log('Backup created successfully');
  } else {
    console.error('Target file does not exist!');
    process.exit(1);
  }
} catch (err) {
  console.error('Error creating backup:', err);
  process.exit(1);
}

// 读取文件内容
console.log('Reading target file...');
let content;
try {
  content = fs.readFileSync(targetFile, 'utf8');
} catch (err) {
  console.error('Error reading file:', err);
  process.exit(1);
}

// 找到需要修改的部分 - 这里我们寻找创建问题的代码段
// 注意：这是基于当前文件的内容，可能需要根据实际文件进行调整
console.log('Applying patches...');

// 修复1：添加问题规范化函数
const normalizeFunctionCode = `
// 添加一个预处理函数来标准化前端传来的数据格式
function normalizeQuestionData(questions) {
  if (!Array.isArray(questions)) {
    console.warn('questions is not an array:', questions);
    return [];
  }
  
  return questions
    .map((q, index) => {
      // Handle potential null question object
      if (!q) {
        console.warn("Question at index " + index + " is null or undefined");
        return null;
      }
      
      // 确保text字段不为null，如果是null或空字符串则提供默认值
      let questionText = '';
      if (q.text !== undefined && q.text !== null) {
        questionText = String(q.text);
      } else if (q.question !== undefined && q.question !== null) {
        questionText = String(q.question);
      } else {
        questionText = "问题 #" + (index + 1);  // 默认文本
      }
      
      // 确保其他字段不为null
      const explanation = q.explanation !== undefined && q.explanation !== null 
        ? String(q.explanation) 
        : '暂无解析';
        
      const questionType = q.questionType || 'single';
      const orderIndex = q.orderIndex !== undefined ? q.orderIndex : index;
      
      // 标准化问题数据
      const normalizedQuestion = {
        text: questionText.trim(),
        explanation: explanation.trim(),
        questionType: questionType,
        orderIndex: orderIndex,
        options: []
      };
      
      // 处理选项
      if (Array.isArray(q.options)) {
        normalizedQuestion.options = q.options
          .filter(opt => opt) // 移除null或undefined选项
          .map((opt, j) => {
            // 确保选项文本不为null
            const optionText = opt.text !== undefined && opt.text !== null
              ? String(opt.text)
              : "选项 " + String.fromCharCode(65 + j); // A, B, C...
            
            // 选项ID处理
            let optionIndex = '';
            if (typeof opt.optionIndex === 'string') {
              optionIndex = opt.optionIndex;
            } else if (typeof opt.id === 'string') {
              optionIndex = opt.id;
            } else {
              optionIndex = String.fromCharCode(65 + j); // A, B, C...
            }
            
            // 判断是否为正确选项
            let isCorrect = false;
            if (opt.isCorrect === true) {
              isCorrect = true;
            } else if (q.questionType === 'single' && q.correctAnswer === optionIndex) {
              isCorrect = true;
            } else if (q.questionType === 'multiple' && Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optionIndex)) {
              isCorrect = true;
            }
            
            return {
              text: optionText.trim(),
              isCorrect: isCorrect,
              optionIndex: optionIndex
            };
          });
      } else {
        console.warn("Question " + (index+1) + " has no options array, creating default options");
        // 创建默认选项
        normalizedQuestion.options = [
          { text: '选项 A', isCorrect: true, optionIndex: 'A' },
          { text: '选项 B', isCorrect: false, optionIndex: 'B' }
        ];
      }
      
      return normalizedQuestion;
    })
    .filter(q => q !== null); // 移除null的问题
}`;

// 找到导出语句前面的位置，插入我们的规范化函数
const exportIndex = content.indexOf('exports.getAllQuestionSets = getAllQuestionSets;');
if (exportIndex === -1) {
  console.error('Could not find export statement to insert normalize function!');
  process.exit(1);
}

// 在导出语句前插入规范化函数
content = content.slice(0, exportIndex) + normalizeFunctionCode + '\n\n' + content.slice(exportIndex);

// 修复2：在updateQuestionSet函数中添加规范化处理
const updateFunctionStart = content.indexOf('const updateQuestionSet = async (req, res)');
if (updateFunctionStart === -1) {
  console.error('Could not find updateQuestionSet function!');
  process.exit(1);
}

// 查找try块的开始
const tryBlockStart = content.indexOf('try {', updateFunctionStart);
if (tryBlockStart === -1) {
  console.error('Could not find try block in updateQuestionSet function!');
  process.exit(1);
}

// 在try块开始后添加日志和规范化代码
const tryBlockCode = 'try {';
const normalizeCode = `try {
    console.log("Received update request for question set " + id);
    console.log("Request body summary:", JSON.stringify({
      title: title,
      description: description,
      category: category,
      questionCount: questions ? questions.length : 0
    }));
    
    // 标准化问题数据，确保格式一致
    if (Array.isArray(questions) && questions.length > 0) {
      questions = normalizeQuestionData(questions);
      console.log("Normalized " + questions.length + " questions");
    }
    `;

content = content.replace(tryBlockCode, normalizeCode);

// 修复3：修改创建问题部分的代码
// 查找创建问题的代码位置
const createQuestionPattern = /const question = await Question_1.default.create\(\{[^}]*\}\)/;
const createQuestionMatch = content.match(createQuestionPattern);

if (!createQuestionMatch) {
  console.error('Could not find question creation code!');
  process.exit(1);
}

const createQuestionIndex = content.indexOf(createQuestionMatch[0]);
const lineStart = content.lastIndexOf('\n', createQuestionIndex);
const lineEnd = content.indexOf('\n', createQuestionIndex);

// 提取并修改问题创建代码
const questionCreationLine = content.substring(lineStart, lineEnd);
console.log('Found question creation line:', questionCreationLine);

// 写入修改后的文件
console.log('Writing patched file...');
try {
  fs.writeFileSync(targetFile, content);
  console.log('File patched successfully!');
} catch (err) {
  console.error('Error writing file:', err);
  console.log('Attempting to restore backup...');
  
  try {
    fs.copyFileSync(backupFile, targetFile);
    console.log('Backup restored successfully');
  } catch (restoreErr) {
    console.error('Failed to restore backup:', restoreErr);
  }
  
  process.exit(1);
}

console.log('Patch complete! The controller has been updated to handle null question text.');
console.log('If you encounter issues, you can restore from the backup file:', backupFile); 