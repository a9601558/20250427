# Socket.IO + Express 配置指南

## 问题描述

1. Socket.IO 404 错误 - `/socket.io/?EIO=4&transport=polling` 路径无法访问
2. Express Rate Limit 错误 - `ValidationError: The Express 'trust proxy' setting is true`

## 解决方案要点

### 1. Socket.IO 必须正确挂载到 HTTP 服务器

Socket.IO 和 Express 必须共享同一个 HTTP 服务器实例。关键是使用 `server.listen()` 而不是 `app.listen()`。

```javascript
const app = express();
const server = createServer(app);
const io = new Server(server, {...});

// 正确: 使用 server.listen
server.listen(5000, '0.0.0.0', () => {...});

// 错误: 不要使用 app.listen
// app.listen(5000, '0.0.0.0', () => {...});
```

### 2. 正确设置 trust proxy

```javascript
// 正确: 设置为数字 1
app.set('trust proxy', 1);  // 只信任第一级代理（通常是 Nginx）

// 错误: 不要设置为 true
// app.set('trust proxy', true);  // 这会无限信任所有代理，存在安全风险
```

### 3. Socket.IO 传输配置

优先使用 polling 传输，确保兼容性：

```javascript
const io = new Server(server, {
  transports: ['polling', 'websocket'], // 先尝试 polling，再尝试 websocket
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});
```

## 已修改的配置

1. 将 `trust proxy` 设置为 `1`
2. 将变量名从 `httpServer` 改为 `server` 以保持一致性
3. 简化了 Socket.IO 配置
4. 移除了自定义 keyGenerator，使用默认的 IP 检测
5. 添加了传输方式日志记录

## 测试方法

使用我们之前创建的诊断工具验证连接：

```bash
node socket-io-debug-test.js
```

重启服务器以应用更改：

```bash
./restart-socket-server.sh 