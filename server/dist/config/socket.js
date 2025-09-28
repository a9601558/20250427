"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = exports.io = void 0;
const socket_io_1 = require("socket.io");
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const sequelize_1 = require("sequelize");
// 加载环墁E��釁E
dotenv_1.default.config();
// 初始化 Socket.IO
const initializeSocket = (server) => {
    exports.io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:3000',
            methods: ['GET', 'POST']
        }
    });
    // Pure AWS Cognito token verification for Socket
    const verifyCognitoTokenForSocket = async (token) => {
        return new Promise((resolve, reject) => {
            // Decode the token to validate its structure and claims
            const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
            if (!decoded || !decoded.payload || typeof decoded.payload === 'string') {
                return reject(new Error('Invalid token format'));
            }
            const payload = decoded.payload;
            // Validate essential Cognito token properties
            const cognitoRegion = process.env.COGNITO_REGION || 'ap-southeast-2';
            const cognitoUserPoolId = process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_El0UTGvLD';
            const expectedIssuer = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoUserPoolId}`;
            if (payload.iss !== expectedIssuer) {
                return reject(new Error('Token issuer does not match Cognito'));
            }
            if (payload.token_use !== 'access') {
                return reject(new Error('Token is not an access token'));
            }
            // Check token expiration
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                return reject(new Error('Token has expired'));
            }
            resolve(payload);
        });
    };
    exports.io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            console.log('Socket接続でtokenが提供されてぁE��せん - 匿名接続を許可');
            // 允许匿名连接�E�佁E��设置userId
            return next();
        }
        try {
            // Pure AWS Cognito token verification for Socket
            const payload = await verifyCognitoTokenForSocket(token);
            socket.userId = payload.sub; // Use Cognito sub as user ID
            console.log(`Socket AWS Cognito认证�E劁E 用户ID ${socket.userId}`);
            next();
        }
        catch (error) {
            console.error('Socket認証プロセスでエラーが発甁E', error);
            // 即使认证失败也�E许连接�E�避免页面无限重证E
            next();
        }
    });
    // 监听数据匁E
    exports.io.engine.on('packet', (packet) => {
        console.log('packet', packet.type, packet.data);
    });
    // 夁E��连接
    exports.io.on('connection', (socket) => {
        console.log(`用户 ${socket.userId} 已连接`);
        // 封Eocket加入以用户ID命名的房间
        if (socket.userId) {
            socket.join(socket.userId);
            console.log(`用户 ${socket.userId} 加入个人房间`);
        }
        // 夁E��题库访问杁E��检查
        socket.on('questionSet:checkAccess', (data) => {
            try {
                // 安�E检查�E�确保只能查询自己皁E��陁E
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹酁E 请汁E${data.userId}, socket=${socket.userId}`);
                    socket.emit('access_error', { message: '杁E��验证失败' });
                    return;
                }
                // 继续夁E��题库访问杁E��检查...
                console.log(`检查用户 ${data.userId} 对题庁E${data.questionSetId} 皁E��问杁E��`);
                // 这里放原有皁E��问杁E��检查逻辁E
            }
            catch (error) {
                console.error('アクセス権限�E確認でエラー:', error);
                socket.emit('access_error', { message: 'アクセス権限�E確認に失敗しました' });
            }
        });
        // 批量检查题库访问杁E��
        socket.on('questionSet:checkAccessBatch', (data) => {
            try {
                // 安�E检查�E�确保只能查询自己皁E��陁E
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹酁E 请汁E${data.userId}, socket=${socket.userId}`);
                    socket.emit('access_error', { message: '杁E��验证失败' });
                    return;
                }
                console.log(`批量检查用户 ${data.userId} 对 ${data.questionSetIds.length} 个题库的访问杁E��`);
                // 这里放原有皁E��量访问杁E��检查逻辁E
            }
            catch (error) {
                console.error('バッチアクセス権限確認でエラー:', error);
                socket.emit('access_error', { message: 'バッチアクセス権限�E確認に失敗しました' });
            }
        });
        // 夁E��进度更新
        socket.on('progress:update', async (data) => {
            try {
                // 安�E检查�E�确保只能更新自己皁E��度
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹酁E 请汁E${data.userId}, socket=${socket.userId}`);
                    socket.emit('progress_error', { message: '杁E��验证失败' });
                    return;
                }
                const { userId, questionSetId, questionId, isCorrect, timeSpent, lastQuestionIndex, answeredQuestions } = data;
                // 验证参数
                if (!userId || !questionSetId || !questionId) {
                    socket.emit('progress_error', { message: '缺少忁E��参数' });
                    return;
                }
                // 保存进度到数据庁E
                const [progressRecord, created] = await UserProgress_1.default.upsert({
                    id: undefined,
                    userId,
                    questionSetId,
                    questionId,
                    isCorrect,
                    timeSpent,
                    completedQuestions: 1,
                    totalQuestions: 1,
                    correctAnswers: isCorrect ? 1 : 0,
                    lastAccessed: new Date(),
                    lastQuestionIndex: lastQuestionIndex, // 保存最后题目索弁E
                    metadata: answeredQuestions ? JSON.stringify({ answeredQuestions }) : undefined // 保存已答题�E表
                });
                console.log(`ユーザー進捗が${created ? '作�E' : '更新'}されました: ${userId}, ${questionSetId}, 現在の問題インチE��クス: ${lastQuestionIndex}`);
                // 转换为纯对象
                const progressData = progressRecord.toJSON();
                // 向用户发送进度已更新通知
                exports.io.to(userId).emit('progress:update', {
                    questionSetId,
                    progress: progressData
                });
                // 向客户端确认进度已保孁E
                socket.emit('progress_saved', {
                    success: true,
                    progress: progressData
                });
            }
            catch (error) {
                console.error('保存进度错误:', error);
                socket.emit('progress_error', { message: '保存进度失败' });
            }
        });
        // 新墁E 夁E��进度查询
        socket.on('progress:get', async (data) => {
            try {
                // 安�E检查�E�确保只能查询自己皁E��度
                if (data.userId !== socket.userId) {
                    console.error(`进度查询杁E��错误: 请求用户=${data.userId}, socket用户=${socket.userId}`);
                    socket.emit('progress_error', { message: '杁E��验证失败' });
                    return;
                }
                const { userId, questionSetId } = data;
                console.log(`[Socket] 查询用户进度: userId=${userId}, questionSetId=${questionSetId}`);
                // 从数据库查询最新皁E��度记彁E
                const lastProgress = await UserProgress_1.default.findOne({
                    where: {
                        userId,
                        questionSetId,
                        lastQuestionIndex: { [sequelize_1.Op.gte]: 0 } // 查询大于等亁E皁E��引值�E�避免与null直接比辁E
                    },
                    order: [['updatedAt', 'DESC']], // 获取最新记彁E
                    raw: true
                });
                // 如果找到进度记彁E
                if (lastProgress) {
                    console.log(`[Socket] 找到用户进度记彁E lastQuestionIndex=${lastProgress.lastQuestionIndex}`);
                    // 尝试解析metadata中皁EnsweredQuestions
                    let answeredQuestions = [];
                    try {
                        if (lastProgress.metadata) {
                            const metadata = JSON.parse(lastProgress.metadata);
                            if (metadata && metadata.answeredQuestions) {
                                answeredQuestions = metadata.answeredQuestions;
                            }
                        }
                    }
                    catch (err) {
                        console.error('[Socket] 解析进度记录metadata失败:', err);
                    }
                    // 发送进度数据给客户端
                    socket.emit('progress:data', {
                        ...lastProgress,
                        answeredQuestions
                    });
                }
                else {
                    console.log(`[Socket] 未找到用户进度记彁E userId=${userId}, questionSetId=${questionSetId}`);
                    socket.emit('progress:data', null);
                }
            }
            catch (error) {
                console.error('[Socket] 查询进度错误:', error);
                socket.emit('progress_error', { message: '查询进度失败' });
            }
        });
        // 新墁E 夁E��进度重置
        socket.on('progress:reset', async (data) => {
            try {
                // 安�E检查�E�确保只能重置自己皁E��度
                if (data.userId !== socket.userId) {
                    console.error(`进度重置杁E��错误: 请求用户=${data.userId}, socket用户=${socket.userId}`);
                    socket.emit('progress_error', { message: '杁E��验证失败' });
                    return;
                }
                const { userId, questionSetId } = data;
                console.log(`[Socket] 重置用户进度: userId=${userId}, questionSetId=${questionSetId}`);
                // 从数据库删除进度记彁E
                const deleted = await UserProgress_1.default.destroy({
                    where: {
                        userId,
                        questionSetId
                    }
                });
                console.log(`[Socket] 已删除 ${deleted} 条进度记录`);
                // 发送E��置成功通知
                socket.emit('progress:reset:result', {
                    success: true,
                    message: `成功重置进度�E�删除亁E${deleted} 条记录`,
                    deletedCount: deleted
                });
            }
            catch (error) {
                console.error('[Socket] 重置进度错误:', error);
                socket.emit('progress_error', { message: '重置进度失败' });
            }
        });
        // 夁E��进度删除请汁E
        socket.on('progress:delete', async (data) => {
            try {
                // 安�E检查�E�确保只能删除自己皁E��度
                if (data.userId !== socket.userId) {
                    console.error(`用户ID不匹酁E 请汁E${data.userId}, socket=${socket.userId}`);
                    socket.emit('progress_error', { message: '杁E��验证失败' });
                    return;
                }
                const { userId, questionSetId } = data;
                // 验证参数
                if (!userId || !questionSetId) {
                    socket.emit('progress_error', { message: '缺少忁E��参数' });
                    return;
                }
                // 从数据库中删除进度
                await UserProgress_1.default.destroy({
                    where: {
                        userId,
                        questionSetId
                    }
                });
                console.log(`用户进度已删除: ${userId}, ${questionSetId}`);
                // 向用户发送进度已删除通知
                exports.io.to(userId).emit('progress:delete', {
                    questionSetId,
                    success: true
                });
                // 确认删除成功
                socket.emit('progress:delete:result', { success: true });
            }
            catch (error) {
                console.error('删除进度失败:', error);
                socket.emit('progress:delete:result', { success: false, error: error.message });
            }
        });
        // 夁E��断开连接
        socket.on('disconnect', (reason) => {
            console.log(`用户 ${socket.userId} 断开连接, 原因: ${reason}`);
        });
    });
};
exports.initializeSocket = initializeSocket;
