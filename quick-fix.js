#!/usr/bin/env node

/**
 * 快速修复脚本 - 直接修改Question.js文件
 * 这是最简洁的解决方案，只有一个修改点
 */

const fs = require('fs');

// 目标文件
const TARGET_FILE = '/www/wwwroot/root/git/dist/server/dist/models/Question.js';
const BACKUP_FILE = `${TARGET_FILE}.backup-${Date.now()}`;

console.log('开始快速修复...');

// 创建备份
try {
  fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
  console.log(`备份已创建: ${BACKUP_FILE}`);
} catch (err) {
  console.error('创建备份失败:', err);
  process.exit(1);
}

// 读取文件
let content;
try {
  content = fs.readFileSync(TARGET_FILE, 'utf8');
  console.log('文件读取成功');
} catch (err) {
  console.error('读取文件失败:', err);
  process.exit(1);
}

// 添加修复代码
const fixCode = `
// ==== 紧急修复: Question.text cannot be null ====
// 重写 Question.create 方法
const originalCreate = Question.create;
Question.create = async function(data, options) {
  // 确保 text 字段有值
  if (!data.text) {
    console.log('检测到 text 字段为 null，应用紧急修复');
    
    // 尝试使用 question 字段
    if (data.question) {
      data.text = data.question;
    } else {
      // 添加默认文本
      data.text = '问题 ' + new Date().toISOString();
    }
    
    console.log('修复后的 text 值:', data.text);
  }
  
  // 调用原始方法
  return originalCreate.call(this, data, options);
};
// ==== 紧急修复结束 ====
`;

// 追加修复代码到文件末尾
try {
  fs.appendFileSync(TARGET_FILE, fixCode);
  console.log('修复代码已添加');
} catch (err) {
  console.error('写入文件失败:', err);
  process.exit(1);
}

console.log(`
✅ 快速修复成功!

这个修复重写了 Question.create 方法，确保 text 字段永远不会为 null。
当检测到 text 字段为 null 时，它会自动使用 question 字段值或生成一个默认值。

下一步:
1. 请重启 Node.js 服务器
2. 再次尝试更新题库

如果需要恢复，备份文件位于: ${BACKUP_FILE}
`); 