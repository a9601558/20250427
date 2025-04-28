# 宝塔面板部署Socket.IO应用指南

## 修复方案要点

1. 在Express中正确使用HTTP服务器和Socket.IO
2. 适当设置trust proxy
3. 确保Nginx配置正确支持WebSocket

## 具体操作步骤

### 1. 正确修改Node.js源代码

以下是主要改动：

```javascript
// 旧代码
app.set('trust proxy', true);  // 或其他值
const httpServer = createServer(app);
httpServer.listen(...);

// 新代码 - 使用这个结构
app.set('trust proxy', 1);  // 只信任第一级代理(nginx)
const server = createServer(app);
const io = new Server(server, {...});
server.listen(5000, '0.0.0.0', () => {...});
```

### 2. 宝塔面板常用操作命令

以下是在宝塔SSH终端中测试和部署的命令：

```bash
# 进入网站目录
cd /www/wwwroot/exam7.jp   # 替换为你的网站目录

# 编译TypeScript项目(如果使用TS)
npx tsc

# 使用PM2启动或重启Node.js应用
pm2 list                    # 查看当前运行的应用
pm2 restart exam7-server    # 重启应用
pm2 logs exam7-server       # 查看应用日志

# 如果没有使用PM2，可以使用以下命令启动
node dist/index.js > server.log 2>&1 &

# 检查Nginx配置
nginx -t

# 重启Nginx
systemctl restart nginx   # 或 /etc/init.d/nginx restart

# 检查日志
tail -f /www/wwwlogs/exam7.jp.error.log  # Nginx错误日志
cat server.log                           # Node.js应用日志
```

### 3. 宝塔面板Nginx配置

在宝塔面板中，需要为Socket.IO添加正确的Nginx配置：

1. 在宝塔面板中打开网站设置
2. 点击"配置文件"
3. 在server块中添加以下配置：

```nginx
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
```

4. 保存并重启Nginx

### 4. 测试连接

1. 将`socket-test-baota.html`文件上传到网站根目录：
   - 使用宝塔面板的文件管理功能上传
   - 或者使用以下命令创建文件：
   ```bash
   nano /www/wwwroot/exam7.jp/socket-test-baota.html
   # 粘贴HTML内容后保存退出
   ```

2. 在浏览器中访问测试页面：
   ```
   http://exam7.jp/socket-test-baota.html
   ```

3. 点击"连接"按钮测试连接
   - 可以尝试不同的传输方式：轮询、WebSocket或两者
   - 连接成功后可以发送消息测试通信

### 5. 故障排查

如果连接失败，请检查：

1. **服务器日志**：
   ```bash
   pm2 logs exam7-server
   ```

2. **Nginx错误日志**：
   ```bash
   tail -f /www/wwwlogs/exam7.jp.error.log
   ```

3. **端口是否开放**：
   在宝塔面板中检查安全选项，确保端口5000已放行

4. **WebSocket支持**：
   确认Nginx配置中包含了正确的WebSocket支持配置

5. **代码是否正确部署**：
   确保使用了正确的server变量和trust proxy设置

6. **浏览器开发者工具**：
   查看网络选项卡中的WebSocket连接状态和错误信息 