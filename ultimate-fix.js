#!/usr/bin/env node

/**
 * 最终修复脚本 - 彻底解决 Question.text cannot be null 问题
 * 
 * 此脚本会执行以下操作:
 * 1. 备份原始文件
 * 2. 修补 Question 模型文件，覆盖 create 方法
 * 3. 修补 questionSetController.js 文件
 */

const fs = require('fs');
const path = require('path');

// 基础目录
const BASE_DIR = '/www/wwwroot/root/git/dist/server';
// 模型文件路径
const QUESTION_MODEL_PATH = `${BASE_DIR}/dist/models/Question.js`;
// 控制器文件路径
const CONTROLLER_PATH = `${BASE_DIR}/dist/controllers/questionSetController.js`;

// 创建备份
function backup(filePath) {
  const backupPath = `${filePath}.backup-${new Date().toISOString().replace(/:/g, '-')}`;
  console.log(`创建 ${filePath} 的备份...`);
  fs.copyFileSync(filePath, backupPath);
  console.log(`备份已保存到: ${backupPath}`);
  return backupPath;
}

// 修补Question模型文件
function patchQuestionModel() {
  console.log(`\n====== 修补 Question 模型 ======`);
  try {
    // 备份原始文件
    const backupPath = backup(QUESTION_MODEL_PATH);
    
    // 读取模型文件
    let modelContent = fs.readFileSync(QUESTION_MODEL_PATH, 'utf8');
    
    // 查找创建方法位置
    const createPatch = `
// 覆盖原始创建方法，确保text字段不为null
// 这是由 ultimate-fix.js 添加的
const originalCreate = Question.create;
Question.create = async function(data, options) {
  console.log("拦截 Question.create 调用，确保text字段不为null");
  console.log("原始数据:", JSON.stringify(data));
  
  // 确保text字段一定有值
  if (!data.text) {
    console.log("警告: text字段为空，设置默认值");
    if (data.question) {
      data.text = data.question;
      console.log("使用question字段值:", data.text);
    } else {
      data.text = "自动生成的问题标题 " + new Date().toISOString();
      console.log("使用生成的默认值:", data.text);
    }
  }
  
  console.log("最终使用的text值:", data.text);
  return originalCreate.call(this, data, options);
};
`;
    
    // 将补丁附加到文件末尾
    modelContent += createPatch;
    
    // 写入修改后的文件
    fs.writeFileSync(QUESTION_MODEL_PATH, modelContent, 'utf8');
    console.log("Question模型已成功修补");
    
    return true;
  } catch (error) {
    console.error("修补Question模型失败:", error);
    return false;
  }
}

// 修补控制器文件
function patchController() {
  console.log(`\n====== 修补 Controller 文件 ======`);
  try {
    // 备份原始文件
    const backupPath = backup(CONTROLLER_PATH);
    
    // 读取控制器文件
    let controllerContent = fs.readFileSync(CONTROLLER_PATH, 'utf8');
    
    // 查找updateQuestionSet函数
    const functionPattern = /const updateQuestionSet = async \(req, res\) => {/;
    const match = controllerContent.match(functionPattern);
    
    if (!match) {
      console.error("无法找到updateQuestionSet函数");
      return false;
    }
    
    // 查找try块的位置
    const tryBlockStart = controllerContent.indexOf("try {", controllerContent.indexOf(match[0]));
    if (tryBlockStart === -1) {
      console.error("无法找到try块");
      return false;
    }
    
    // 在try块后插入预处理代码
    const prePatch = `
    // 直接修复由ultimate-fix.js添加
    console.log("进入updateQuestionSet函数");
    console.log("请求体:", JSON.stringify(req.body));
    
    // 修复前端数据格式问题
    if (Array.isArray(questions)) {
      console.log("预处理questions数组，数量:", questions.length);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q) continue;
        
        console.log("处理question #" + (i+1), JSON.stringify(q));
        
        // 从question字段复制到text字段
        if (q.question !== undefined && !q.text) {
          q.text = q.question;
          console.log("将question字段 '" + q.question + "' 复制到text字段");
        }
        
        // 确保text字段有值
        if (!q.text) {
          q.text = "问题 #" + (i+1);
          console.log("设置默认text值:", q.text);
        }
      }
    }
`;
    
    // 在特定位置插入一个日志代码块，用于诊断
    const loggingSnippet = `
            // 由ultimate-fix.js添加的调试代码
            console.log("=========== 问题创建前 ===========");
            console.log("问题索引:", i);
            console.log("questions[i].text =", questions[i].text);
            console.log("questions[i].question =", questions[i].question);
            console.log("问题JSON:", JSON.stringify(questions[i]));
            console.log("====================================");
            
            // 强制确保text有值
            if (!questions[i].text) {
              questions[i].text = "问题 #" + (i+1) + " (紧急修复)";
              console.log("紧急修复: 设置text =", questions[i].text);
            }
`;
    
    // 查找创建问题的循环
    const forLoopPattern = /for.*\(.*let i = 0.*i < questions\.length.*i\+\+.*\)/;
    const forLoopMatch = controllerContent.substring(tryBlockStart).match(forLoopPattern);
    
    if (!forLoopMatch) {
      console.error("无法找到处理问题的循环");
      return false;
    }
    
    // 找到循环开始的位置
    const forLoopStart = controllerContent.indexOf(forLoopMatch[0], tryBlockStart);
    const forLoopBlockStart = controllerContent.indexOf("{", forLoopStart) + 1;
    
    // 插入预处理代码
    let newContent = controllerContent.substring(0, tryBlockStart + 5) + 
                    prePatch + 
                    controllerContent.substring(tryBlockStart + 5, forLoopBlockStart) + 
                    loggingSnippet + 
                    controllerContent.substring(forLoopBlockStart);
    
    // 写入修改后的文件
    fs.writeFileSync(CONTROLLER_PATH, newContent, 'utf8');
    console.log("Controller文件已成功修补");
    
    return true;
  } catch (error) {
    console.error("修补Controller失败:", error);
    return false;
  }
}

// 主函数
(async function main() {
  console.log("开始最终修复...");
  
  const modelFixed = patchQuestionModel();
  const controllerFixed = patchController();
  
  if (modelFixed && controllerFixed) {
    console.log("\n✅ 修复成功!");
    console.log(`
修复总结:
1. 重写了 Question.create 方法，确保 text 字段永远不为null
2. 在 Controller 中添加了额外的预处理步骤
3. 添加了详细的日志记录，帮助诊断问题

下一步:
1. 请重启Node.js服务器
2. 再次尝试更新题库
3. 查看服务器日志，确认修复是否生效
`);
  } else {
    console.log("\n❌ 修复失败!");
    console.log("请查看上面的错误信息，并手动修复问题");
  }
})(); 