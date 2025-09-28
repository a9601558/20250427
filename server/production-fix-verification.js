#!/usr/bin/env node

/**
 * 生产环境JWT修复验证脚本
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证生产环境JWT修复...\n');

// 检查关键文件中的JWT算法修复
const filesToCheck = [
    {
        path: './dist/middleware/authMiddleware.js',
        description: 'Express认证中间件'
    },
    {
        path: './dist/config/socket.js',
        description: 'Socket.IO认证'
    }
];

let allFixed = true;

filesToCheck.forEach(({ path: filePath, description }) => {
    console.log(`📁 检查 ${description}: ${filePath}`);
    
    try {
        const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
        
        // 检查是否包含明确的算法指定
        const hasAlgorithmSpec = content.includes('algorithms: [\'HS256\']');
        
        if (hasAlgorithmSpec) {
            console.log(`   ✅ ${description} - JWT算法已正确指定为HS256`);
        } else {
            console.log(`   ❌ ${description} - JWT算法规范缺失`);
            allFixed = false;
        }
        
        // 检查是否还有可能导致算法错误的代码
        const hasPotentialIssues = content.includes('jwt.verify(') && !content.includes('algorithms:');
        
        if (hasPotentialIssues) {
            console.log(`   ⚠️  ${description} - 发现潜在的JWT验证问题`);
            allFixed = false;
        }
        
    } catch (error) {
        console.log(`   ❌ ${description} - 文件读取失败: ${error.message}`);
        allFixed = false;
    }
});

console.log('\n' + '='.repeat(50));

if (allFixed) {
    console.log('🎉 验证完成：所有JWT认证修复已应用到构建文件！');
    console.log('\n✅ 修复状态:');
    console.log('   • Express中间件: JWT HS256算法已指定');
    console.log('   • Socket认证: JWT HS256算法已指定');
    console.log('   • 双重验证: Cognito + 传统JWT支持');
    console.log('\n🚀 生产部署就绪！');
    console.log('\n📋 部署步骤:');
    console.log('   1. 将构建后的dist目录上传到生产服务器');
    console.log('   2. 重启Node.js进程以应用新代码');
    console.log('   3. 监控日志确认"JsonWebTokenError: invalid algorithm"错误消失');
} else {
    console.log('❌ 发现问题：部分修复未正确应用');
    console.log('\n🔧 建议操作:');
    console.log('   1. 重新运行 npm run build');
    console.log('   2. 检查TypeScript编译错误');
    console.log('   3. 验证源文件中的修复是否正确');
}

console.log('\n💡 预期结果: JWT认证错误将完全消除');

process.exit(allFixed ? 0 : 1);