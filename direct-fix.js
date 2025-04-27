#!/usr/bin/env node

/**
 * 直接修改服务器上的JavaScript文件的脚本
 * 这个脚本可以直接在服务器上运行，不需要编译TypeScript
 */

const fs = require('fs');
const path = require('path');

// 目标文件路径
const TARGET_FILE = '/www/wwwroot/root/git/dist/server/dist/controllers/questionSetController.js';
const BACKUP_FILE = `${TARGET_FILE}.backup-${new Date().toISOString().replace(/:/g, '-')}`;

console.log('开始修复过程...');

// 1. 创建备份
try {
  console.log(`创建备份: ${BACKUP_FILE}`);
  fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
  console.log('备份创建成功');
} catch (error) {
  console.error('创建备份失败:', error.message);
  process.exit(1);
}

// 2. 读取文件
let content;
try {
  console.log(`读取文件: ${TARGET_FILE}`);
  content = fs.readFileSync(TARGET_FILE, 'utf8');
  console.log('文件读取成功');
} catch (error) {
  console.error('读取文件失败:', error.message);
  process.exit(1);
}

// 3. 找到需要修改的位置
console.log('查找updateQuestionSet函数...');
const updateFunctionPattern = /const updateQuestionSet = async \(req, res\)/;
const match = content.match(updateFunctionPattern);

if (!match) {
  console.error('无法找到updateQuestionSet函数');
  process.exit(1);
}

// 找到函数开始位置
const functionStartIndex = content.indexOf(match[0]);
console.log(`找到函数位置: 字符索引 ${functionStartIndex}`);

// 找到处理questions的位置
const processQuestionsPattern = /if \(Array\.isArray\(questions\) && questions\.length > 0\)/;
const questionsMatch = content.substring(functionStartIndex).match(processQuestionsPattern);

if (!questionsMatch) {
  console.error('无法找到处理questions的代码段');
  process.exit(1);
}

// 找到处理questions的位置 (相对于函数开始)
const questionsIndex = content.substring(functionStartIndex).indexOf(questionsMatch[0]) + functionStartIndex;
console.log(`找到处理questions的位置: 字符索引 ${questionsIndex}`);

// 4. 在处理questions前插入预处理代码
const preprocessCode = `
    // 特殊处理: 确保问题有正确的text字段 (直接修复)
    if (Array.isArray(questions)) {
        console.log("预处理问题数据，总数: " + questions.length);
        questions = questions.map(function(q, index) {
            if (!q) return q;
            
            console.log("检查问题 #" + (index+1) + ": " + JSON.stringify(q));
            
            // 处理 q.question 转换为 q.text
            if (q.question !== undefined && q.text === undefined) {
                console.log("问题 #" + (index+1) + ": 将question字段 '" + q.question + "' 复制到text字段");
                q.text = q.question;
            }
            
            // 确保text非空
            if (q.text === undefined || q.text === null || q.text === '') {
                q.text = "问题 #" + (index+1) + " (自动生成)";
                console.log("问题 #" + (index+1) + ": 设置默认text: " + q.text);
            }
            
            return q;
        });
    }
`;

// 5. 插入代码
console.log('插入预处理代码...');
const newContent = content.substring(0, questionsIndex) + preprocessCode + content.substring(questionsIndex);

// 6. 写入修改后的文件
try {
  console.log('写入修改后的文件...');
  fs.writeFileSync(TARGET_FILE, newContent, 'utf8');
  console.log('文件写入成功');
} catch (error) {
  console.error('写入文件失败:', error.message);
  
  // 尝试恢复备份
  try {
    console.log('尝试恢复备份...');
    fs.copyFileSync(BACKUP_FILE, TARGET_FILE);
    console.log('备份恢复成功');
  } catch (restoreError) {
    console.error('恢复备份失败:', restoreError.message);
  }
  
  process.exit(1);
}

console.log('修复成功!');
console.log(`
修复总结:
1. 添加了对问题数据的预处理，确保每个问题都有text字段
2. 处理了q.question到q.text的自动转换
3. 为空text设置了默认值

备份文件保存在: ${BACKUP_FILE}
`);

console.log('请重启服务器以应用更改'); 