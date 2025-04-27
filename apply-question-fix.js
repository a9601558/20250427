#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 配置信息
const TARGET_FILE = '/www/wwwroot/root/git/dist/server/dist/controllers/questionSetController.js';
const BACKUP_FILE = `${TARGET_FILE}.backup-${new Date().toISOString().replace(/:/g, '-')}`;
const FIX_FILE = path.join(__dirname, 'question-controller-fix.js');

/**
 * 应用修复程序
 */
async function applyFix() {
  try {
    // 检查目标文件是否存在
    if (!fs.existsSync(TARGET_FILE)) {
      console.error(`[错误] 目标文件不存在: ${TARGET_FILE}`);
      return false;
    }

    console.log(`[信息] 开始修复 ${TARGET_FILE}`);
    
    // 创建备份
    fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
    console.log(`[信息] 已创建备份: ${BACKUP_FILE}`);
    
    // 读取当前文件内容
    const currentContent = fs.readFileSync(TARGET_FILE, 'utf8');
    
    // 读取修复代码
    const fixContent = fs.readFileSync(FIX_FILE, 'utf8');
    console.log(`[信息] 已读取修复代码，长度: ${fixContent.length} 字节`);
    
    // 查找导出语句位置，这是我们要替换的函数的标记
    const exportStatement = 'exports.updateQuestionSet = updateQuestionSet;';
    const exportPos = currentContent.indexOf(exportStatement);
    
    if (exportPos === -1) {
      console.error('[错误] 无法找到导出语句，无法应用修复');
      return false;
    }
    
    // 查找函数定义的开始
    const functionDefPattern = /const updateQuestionSet = async/;
    const functionDefMatch = currentContent.match(functionDefPattern);
    
    if (!functionDefMatch) {
      console.error('[错误] 无法找到 updateQuestionSet 函数定义');
      return false;
    }
    
    const functionStartPos = currentContent.indexOf(functionDefMatch[0]);
    
    if (functionStartPos === -1) {
      console.error('[错误] 无法确定函数开始位置');
      return false;
    }
    
    // 创建新的内容，替换函数
    const newContent = 
      currentContent.substring(0, functionStartPos) + 
      fixContent + 
      currentContent.substring(exportPos);
    
    // 写入修复后的文件
    fs.writeFileSync(TARGET_FILE, newContent, 'utf8');
    
    console.log(`[成功] 已应用修复到 ${TARGET_FILE}`);
    console.log(`[信息] 添加了 normalizeQuestionData 函数`);
    console.log(`[信息] 更新了 updateQuestionSet 函数`);
    console.log(`[信息] 改进了错误处理和日志记录`);
    
    return true;
  } catch (error) {
    console.error(`[致命错误] 应用修复时出错: ${error.message}`);
    
    // 尝试从备份恢复
    if (fs.existsSync(BACKUP_FILE)) {
      console.log('[恢复] 正在从备份恢复...');
      fs.copyFileSync(BACKUP_FILE, TARGET_FILE);
      console.log('[恢复] 从备份恢复成功');
    }
    
    return false;
  }
}

// 执行修复
applyFix()
  .then(success => {
    if (success) {
      console.log('[完成] 修复已成功应用');
      console.log('[信息] 备份文件保留在: ' + BACKUP_FILE);
    } else {
      console.error('[失败] 修复未能成功应用');
      console.log('[信息] 如果存在备份，您可以手动恢复: ' + BACKUP_FILE);
    }
  })
  .catch(err => {
    console.error('[未处理错误]', err);
    process.exit(1);
  }); 