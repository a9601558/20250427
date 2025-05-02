"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncDatabase = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const helmet_1 = __importDefault(require("helmet"));
// @ts-ignore
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const database_1 = __importDefault(require("./config/database"));
const handlers_1 = __importDefault(require("./socket/handlers"));
const routes_1 = __importDefault(require("./routes"));
const logger_1 = require("./utils/logger");
// 创建Express应用
const app = (0, express_1.default)();
// 配置中间件
app.use((0, cors_1.default)());
// @ts-ignore
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // 如有需要，调整CSP设置
}));
// @ts-ignore
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 开发环境下使用morgan日志
if (process.env.NODE_ENV !== 'production') {
    app.use((0, morgan_1.default)('dev'));
}
// 注册API路由
(0, routes_1.default)(app);
// 配置静态文件服务
const staticPath = path_1.default.join(__dirname, '../../public');
app.use(express_1.default.static(staticPath));
// 创建HTTP服务器
const server = http_1.default.createServer(app);
// 设置Socket.IO
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // 生产环境中应设置为特定域名
        methods: ['GET', 'POST'],
    },
});
// 注册Socket处理程序
(0, handlers_1.default)(io);
// 处理根路径
app.get('/', (req, res) => {
    res.send('服务器正常运行');
});
// 捕获所有其他路由并返回静态文件
// 这允许前端使用客户端路由
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(staticPath, 'index.html'));
});
// 启动数据库同步（如果需要）
const syncDatabase = async () => {
    try {
        await database_1.default.sync({ alter: true });
        logger_1.logger.info('数据库同步完成');
        return true;
    }
    catch (error) {
        logger_1.logger.error('数据库同步失败:', error);
        return false;
    }
};
exports.syncDatabase = syncDatabase;
// 导出app和server
exports.default = server;
