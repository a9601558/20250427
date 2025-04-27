#!/bin/bash

# 测试前端访问的路径
echo "测试前端访问路径 /api/users/register:"
curl -X POST -H "Content-Type: application/json" -d '{"username":"test","password":"test123","email":"test@example.com"}' http://exam7.jp/api/users/register -v

echo -e "\n\n测试后端直接访问路径:"
echo "1. 测试 /api/users/register 路径:"
curl -X POST -H "Content-Type: application/json" -d '{"username":"test","password":"test123","email":"test@example.com"}' http://localhost:5000/api/users/register -v

echo -e "\n\n2. 测试 /users/register 路径:"
curl -X POST -H "Content-Type: application/json" -d '{"username":"test","password":"test123","email":"test@example.com"}' http://localhost:5000/users/register -v

# 检查 Nginx 错误日志
echo -e "\n\nNginx 错误日志最后10行:"
sudo tail -n 10 /www/wwwlogs/exam7.jp.error.log

# 检查应用程序日志
echo -e "\n\n应用服务器日志:"
# 根据您的应用日志位置调整
sudo tail -n 20 /path/to/your/app/log 