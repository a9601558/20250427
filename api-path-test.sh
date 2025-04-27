#!/bin/bash
# API路径测试和检测工具
# 使用方法: ./api-path-test.sh

# 颜色代码
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # 无颜色

# 测试信息
echo -e "${CYAN}===== API路径测试工具 =====${NC}"
echo "测试前端路径和后端路径的匹配情况"

# 后端基本URL
BACKEND_BASE="http://localhost:5000"
echo -e "\n${CYAN}后端基本URL:${NC} $BACKEND_BASE"

# 测试数据
USERNAME="testuser_$(date +%s)"
PASSWORD="Password123"
EMAIL="test_$(date +%s)@example.com"

TEST_DATA="{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\",\"email\":\"$EMAIL\"}"
echo -e "\n${CYAN}测试数据:${NC}"
echo "$TEST_DATA"

# API端点定义
declare -A endpoints
endpoints=(
  ["注册 (直接)"]="/users/register"
  ["注册 (有api前缀)"]="/api/users/register"
  ["登录 (直接)"]="/users/login"
  ["登录 (有api前缀)"]="/api/users/login"
)

# 结果记录
declare -A results
declare -A path_mappings

# 测试所有端点
echo -e "\n${CYAN}开始测试API端点...${NC}"

for name in "${!endpoints[@]}"; do
  path=${endpoints[$name]}
  url="$BACKEND_BASE$path"
  
  echo -e "\n${CYAN}测试:${NC} $name ($url)"
  
  response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d "$TEST_DATA" \
    "$url")
  
  if [ "$response" == "200" ] || [ "$response" == "201" ]; then
    echo -e "${GREEN}✓ 成功! HTTP状态码: $response${NC}"
    results[$name]="成功"
  else
    echo -e "${RED}✗ 失败! HTTP状态码: $response${NC}"
    results[$name]="失败"
  fi
done

# 分析结果
echo -e "\n${CYAN}===== 结果分析 =====${NC}"
echo -e "HTTP状态码 20x 表示端点正常工作\n"

for name in "${!endpoints[@]}"; do
  path=${endpoints[$name]}
  status=${results[$name]}
  
  if [ "$status" == "成功" ]; then
    echo -e "${GREEN}$path - 有效${NC}"
    
    # 记录有效的路径映射
    if [[ $path == /api/* ]]; then
      frontend_path=$path
      backend_path=${path#/api}
      path_mappings[$frontend_path]=$backend_path
    else
      backend_path=$path
      frontend_path="/api$path"
      path_mappings[$frontend_path]=$backend_path
    fi
  else
    echo -e "${RED}$path - 无效${NC}"
  fi
done

# 生成Nginx配置
echo -e "\n${CYAN}===== 生成Nginx配置 =====${NC}"

if [ ${#path_mappings[@]} -eq 0 ]; then
  echo -e "${RED}未发现有效的路径映射${NC}"
else
  echo -e "${GREEN}根据测试结果生成的路径映射:${NC}"
  echo
  echo "# 自动生成的API路径映射 - $(date)"
  echo
  
  for frontend_path in "${!path_mappings[@]}"; do
    backend_path=${path_mappings[$frontend_path]}
    echo -e "${YELLOW}前端路径:${NC} $frontend_path ${YELLOW}映射到后端:${NC} $backend_path"
    
    echo "location = $frontend_path {"
    echo "  proxy_pass $BACKEND_BASE$backend_path;"
    echo "  proxy_http_version 1.1;"
    echo "  proxy_set_header Host \$host;"
    echo "  proxy_set_header X-Real-IP \$remote_addr;"
    echo "  # 更多代理设置..."
    echo "}"
    echo
  done
  
  echo -e "${CYAN}将以上配置添加到您的Nginx配置文件中${NC}"
fi

echo -e "\n${CYAN}===== 测试完成 =====${NC}" 