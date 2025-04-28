import { io } from "socket.io-client";

// 设置服务器 URL
const serverUrl = "http://exam7.jp";

// 连接参数
const options = {
  path: "/socket.io/",
  transports: ["websocket"],
  reconnectionAttempts: 3,
  timeout: 10000,
  reconnectionDelay: 1000,
  extraHeaders: {
    "User-Agent": "Socket.IO Tester"
  },
  cors: {
    origin: "http://exam7.jp",
    methods: ["GET", "POST"],
    credentials: true
  }
};

console.log(`尝试连接到 ${serverUrl}，路径: ${options.path}...`);

// 创建连接
const socket = io(serverUrl, options);

// 设置连接事件监听器
socket.on("connect", () => {
  console.log(`✅ 连接成功! Socket ID: ${socket.id}`);
  console.log(`✅ 传输方式: ${socket.io.engine.transport.name}`);
  
  // 发送测试消息
  socket.emit("message", "Hello from test client");
  
  // 5秒后断开连接
  setTimeout(() => {
    console.log("测试完成，正在断开连接...");
    socket.disconnect();
  }, 5000);
});

// 监听自定义消息
socket.on("message", (data) => {
  console.log(`📨 收到消息: ${data}`);
});

// 监听连接错误
socket.on("connect_error", (error) => {
  console.error(`❌ 连接错误: ${error.message}`);
  console.error("错误详情:", error);
});

// 监听断开连接
socket.on("disconnect", (reason) => {
  console.log(`❌ 连接断开: ${reason}`);
});

// 监听重连尝试
socket.on("reconnect_attempt", (attempt) => {
  console.log(`🔄 重连尝试 #${attempt}`);
});

// 监听重连成功
socket.on("reconnect", (attempt) => {
  console.log(`✅ 重连成功，尝试次数: ${attempt}`);
});

// 监听重连失败
socket.on("reconnect_failed", () => {
  console.error("❌ 重连失败，已达到最大尝试次数");
}); 