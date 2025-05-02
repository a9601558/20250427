#!/usr/bin/env node

/**
 * 宝塔面板配置指南脚本
 * 此脚本会输出配置宝塔面板和Nginx的步骤
 */

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
};

console.log(`${colors.magenta}${colors.bold}===== 宝塔面板配置指南 =====\n${colors.reset}`);
console.log(`${colors.cyan}此脚本将指导您为 Node.js + Socket.IO 项目配置宝塔面板和Nginx。${colors.reset}\n`);

console.log(`${colors.yellow}${colors.bold}步骤 1: 配置安全组和防火墙${colors.reset}`);
console.log('1. 在AWS控制台中，找到EC2实例的安全组');
console.log('2. 添加入站规则，允许TCP端口5000的流量');
console.log('3. 在宝塔面板中，找到"安全"选项');
console.log('4. 添加放行端口5000\n');

console.log(`${colors.yellow}${colors.bold}步骤 2: 在宝塔面板添加网站${colors.reset}`);
console.log('1. 在宝塔面板中，点击"网站"');
console.log('2. 点击"添加站点"');
console.log('3. 域名输入: exam7.jp');
console.log('4. 选择PHP版本为: 纯静态');
console.log('5. 完成站点创建\n');

console.log(`${colors.yellow}${colors.bold}步骤 3: 添加反向代理${colors.reset}`);
console.log('1. 在网站管理中找到刚创建的网站');
console.log('2. 点击"设置" -> "反向代理"');
console.log('3. 点击"添加反向代理"');
console.log('4. 设置以下信息:');
console.log('   - 代理名称: socket');
console.log('   - 目标URL: http://127.0.0.1:5000');
console.log('   - 发送域名: $host');
console.log('   - 勾选"启用WebSocket支持"');
console.log('5. 点击"提交"\n');

console.log(`${colors.yellow}${colors.bold}步骤 4: 配置Nginx${colors.reset}`);
console.log('1. 在网站管理中找到刚创建的网站');
console.log('2. 点击"设置" -> "配置文件"');
console.log('3. 找到server块');
console.log('4. 在server块中添加以下内容:');

console.log(`${colors.cyan}
    # Socket.IO 专用配置
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache off;
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
${colors.reset}`);

console.log('5. 点击"保存"\n');

console.log(`${colors.yellow}${colors.bold}步骤 5: 重启Nginx${colors.reset}`);
console.log('1. 在宝塔面板中，点击左侧的"软件商店"');
console.log('2. 找到并点击"Nginx"');
console.log('3. 点击"重启"\n');

console.log(`${colors.yellow}${colors.bold}步骤 6: 启动Node.js应用${colors.reset}`);
console.log('1. 进入项目目录');
console.log('2. 安装PM2: npm install -g pm2');
console.log('3. 使用PM2启动应用:');
console.log('   pm2 start dist/server.js --name "exam7-server"');
console.log('4. 或者使用我们的启动脚本:');
console.log('   node server/start-server.js\n');

console.log(`${colors.yellow}${colors.bold}步骤 7: 验证连接${colors.reset}`);
console.log('1. 使用验证脚本测试连接:');
console.log('   node validate-socket.js');
console.log('2. 或者访问测试页面:');
console.log('   http://exam7.jp/socket-test-updated.html\n');

console.log(`${colors.green}${colors.bold}完成以上步骤后，WebSocket应该能够正常连接。${colors.reset}`);
console.log('如果仍然遇到问题，请检查:');
console.log('1. 服务器日志查找错误: pm2 logs');
console.log('2. Nginx错误日志: tail -f /www/wwwlogs/exam7.jp.error.log');
console.log('3. 浏览器开发者工具的网络面板，查看WebSocket连接状态\n');

console.log(`${colors.blue}祝您配置成功！${colors.reset}`); 
