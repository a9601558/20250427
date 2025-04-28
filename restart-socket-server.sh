#!/bin/bash

# Socket.IO服务器重启脚本
# 此脚本重启Node.js服务和Nginx服务

# 文字颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===== Socket.IO 服务重启脚本 =====${NC}\n"

# 1. 重启Node.js服务
echo -e "${YELLOW}正在重启 Node.js 服务...${NC}"
cd /www/wwwroot/server || { echo -e "${RED}错误: 无法进入服务器目录${NC}"; exit 1; }

# 如果使用PM2
if command -v pm2 &> /dev/null; then
    echo "使用PM2重启服务..."
    
    # 检查是否已存在exam7-server应用
    if pm2 list | grep -q "exam7-server"; then
        # 重启现有应用
        pm2 restart exam7-server
    else
        # 首次启动
        pm2 start dist/server.js --name "exam7-server" --watch --max-memory-restart 500M
    fi
else
    echo -e "${RED}PM2未安装，使用node直接启动...${NC}"
    # 先终止正在运行的Node进程
    pkill -f "node.*server.js" || true
    nohup node dist/server.js > server.log 2>&1 &
fi

echo -e "${GREEN}Node.js服务已重启${NC}\n"

# 2. 重启Nginx
echo -e "${YELLOW}正在重启Nginx服务...${NC}"
if command -v /www/server/nginx/sbin/nginx &> /dev/null; then
    # 宝塔面板的Nginx路径
    /www/server/nginx/sbin/nginx -t && { 
        echo "Nginx配置测试通过，正在重启..."; 
        /etc/init.d/nginx restart; 
    } || { 
        echo -e "${RED}Nginx配置测试失败，请检查配置${NC}"; 
    }
else
    # 标准Nginx路径
    nginx -t && { 
        echo "Nginx配置测试通过，正在重启..."; 
        systemctl restart nginx || service nginx restart; 
    } || { 
        echo -e "${RED}Nginx配置测试失败，请检查配置${NC}"; 
    }
fi

echo -e "${GREEN}Nginx服务已重启${NC}\n"

# 3. 检查服务状态
echo -e "${YELLOW}检查服务状态...${NC}"

# 检查Node.js服务
if command -v pm2 &> /dev/null; then
    echo "PM2状态:"
    pm2 status exam7-server
    echo ""
else
    echo "Node.js进程:"
    ps aux | grep -v grep | grep "node.*server.js" || echo -e "${RED}未找到Node.js进程${NC}"
    echo ""
fi

# 检查Nginx状态
echo "Nginx状态:"
if systemctl status nginx &> /dev/null; then
    systemctl status nginx | grep "Active:"
elif service nginx status &> /dev/null; then
    service nginx status | grep "Active:"
else
    /etc/init.d/nginx status
fi

echo -e "\n${GREEN}完成!${NC} 您现在可以测试Socket.IO连接:"
echo "1. 在浏览器中打开: http://exam7.jp/socket-test-updated.html"
echo "2. 或使用验证脚本: node validate-socket.js"
echo "3. 测试轮询连接: node validate-socket-polling.js"

echo -e "\n${BLUE}如果仍有问题，请检查日志:${NC}"
echo "1. PM2日志: pm2 logs exam7-server"
echo "2. Nginx错误日志: tail -f /www/wwwlogs/exam7.jp.error.log" 