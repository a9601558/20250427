# Nginx 配置指南

## 配置说明

我们提供的 Nginx 配置针对以下几个方面进行了优化：

1. **请求头大小限制增加**：解决大型请求头（如大型 cookie、JWT 令牌等）可能导致的 431 错误
2. **代理设置**：正确代理 API 请求到后端服务器
3. **前端路由支持**：支持前端 SPA 应用的路由系统
4. **性能优化**：包括静态资源缓存、Gzip 压缩等

## 主要配置参数解释

### 请求头大小限制相关

```nginx
client_header_buffer_size 64k;      # 客户端请求头部的缓冲区大小
large_client_header_buffers 4 128k; # 大型请求头的缓冲区数量和大小
client_max_body_size 50M;           # 客户端请求体的最大允许大小
client_body_buffer_size 256k;       # 请求体的缓冲区大小
```

这些参数能有效解决以下问题：
- "413 Request Entity Too Large" 错误（请求体过大）
- "431 Request Header Fields Too Large" 错误（请求头过大）
- 大型 cookie 或含有大量数据的 JWT 令牌传输问题

## 应用配置指南

### 1. 将配置文件放置在正确位置

```bash
# Ubuntu/Debian 系统
sudo cp nginx.conf /etc/nginx/nginx.conf

# 或者作为独立配置（推荐）
sudo cp nginx.conf /etc/nginx/conf.d/exam-practice-app.conf
```

### 2. 验证配置文件语法

```bash
sudo nginx -t
```

如果输出包含 `syntax is ok` 和 `test is successful`，则配置文件语法正确。

### 3. 修改域名和文件路径

请根据您的实际情况修改以下配置：

```nginx
server_name example.com;  # 替换为您的实际域名
root /var/www/exam-practice-app/dist;  # 替换为您的应用前端构建文件路径
```

### 4. 重启 Nginx 服务

```bash
sudo systemctl restart nginx
# 或
sudo service nginx restart
```

## 可选：仅应用请求头大小限制

如果您只需要增加请求头大小限制，可以将以下内容添加到您现有的 Nginx 配置中：

```nginx
# 在 http {} 块内添加
client_header_buffer_size 64k;
large_client_header_buffers 4 128k;
client_max_body_size 50M;
client_body_buffer_size 256k;
```

## 故障排查

如果遇到问题，请检查 Nginx 错误日志：

```bash
sudo tail -f /var/log/nginx/error.log
```

常见问题包括：
- 权限问题：确保 Nginx 用户对网站目录有读取权限
- 端口冲突：确保端口 80/443 没有被其他服务占用
- 上游连接问题：确保后端 API 服务器正在运行且可访问

## 安全注意事项

虽然我们增加了请求头大小限制，但仍建议监控服务器资源使用情况，防止潜在的 DoS 攻击。考虑添加额外的安全措施，如请求频率限制或 Web 应用防火墙。 