"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = __importDefault(require("./config/database"));
const http_1 = require("http");
const socket_1 = require("./config/socket");
const associations_1 = require("./models/associations");
const appstate_1 = require("./utils/appstate");
const HomepageSettings_1 = __importDefault(require("./models/HomepageSettings"));
const applyFieldMappings_1 = require("./utils/applyFieldMappings");
const errorMiddleware_1 = __importDefault(require("./middleware/errorMiddleware"));
const sequelize_1 = require("sequelize");
// Load environment variables
const envPath = path_1.default.resolve(__dirname, '../.env');
if (fs_1.default.existsSync(envPath)) {
    console.log('加载环境变量文件:', envPath);
    dotenv_1.default.config({ path: envPath });
}
else {
    console.log('未找到.env文件，使用默认环境变量');
    dotenv_1.default.config();
}
// Import models to ensure they are initialized
require("./models/User");
require("./models/QuestionSet");
require("./models/Question");
require("./models/Option");
require("./models/Purchase");
require("./models/RedeemCode");
require("./models/UserProgress");
// Import routes
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const questionSetRoutes_1 = __importDefault(require("./routes/questionSetRoutes"));
const questionRoutes_1 = __importDefault(require("./routes/questionRoutes"));
const userProgressRoutes_1 = __importDefault(require("./routes/userProgressRoutes"));
const purchaseRoutes_1 = __importDefault(require("./routes/purchaseRoutes"));
const redeemCodeRoutes_1 = __importDefault(require("./routes/redeemCodeRoutes"));
const homepageRoutes_1 = __importDefault(require("./routes/homepageRoutes"));
const wrongAnswerRoutes_1 = __importDefault(require("./routes/wrongAnswerRoutes"));
const quizRoutes_1 = __importDefault(require("./routes/quizRoutes"));
// Initialize express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// 设置trust proxy为1，只信任第一级代理（通常是Nginx）
app.set('trust proxy', 1);
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, morgan_1.default)('dev'));
app.use((0, helmet_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);
// API routes
app.use('/api/users', userRoutes_1.default);
app.use('/api/question-sets', questionSetRoutes_1.default);
app.use('/api/questions', questionRoutes_1.default);
app.use('/api/user-progress', userProgressRoutes_1.default);
app.use('/api/purchases', purchaseRoutes_1.default);
app.use('/api/redeem-codes', redeemCodeRoutes_1.default);
app.use('/api/homepage', homepageRoutes_1.default);
app.use('/api/wrong-answers', wrongAnswerRoutes_1.default);
app.use('/api/quiz', quizRoutes_1.default);
// 添加路由别名，解决旧路径问题
app.use('/api/progress', userProgressRoutes_1.default);
// 添加别名路由 /api/users/:userId/progress
app.use('/api/users/:userId/progress', (req, res, next) => {
    // 将请求转发到 /api/user-progress/:userId
    req.url = '/' + req.params.userId;
    (0, userProgressRoutes_1.default)(req, res, next);
});
// Error handling middleware
app.use(errorMiddleware_1.default);
// Start server
const server = (0, http_1.createServer)(app);
// Initialize socket
(0, socket_1.initializeSocket)(server);
// 初始化模型关联
console.log('正在初始化模型关联...');
(0, associations_1.setupAssociations)();
appstate_1.appState.associationsInitialized = true;
console.log('模型关联初始化完成');
// 应用字段映射修复
(0, applyFieldMappings_1.applyGlobalFieldMappings)();
// 同步数据库并启动服务器
// 修改: 禁用自动 alter 选项，避免"Too many keys"错误
const syncOptions = {
    alter: process.env.NODE_ENV === 'development' && process.env.DB_ALTER === 'true'
};
console.log(`数据库同步选项: ${JSON.stringify(syncOptions)}`);
const startServer = async () => {
    try {
        // Test database connection
        await database_1.default.authenticate();
        console.log('数据库连接成功!');
        // Run migrations first if in production
        if (process.env.NODE_ENV === 'production' || process.env.DB_MIGRATE === 'true') {
            console.log('正在运行数据库迁移脚本...');
            try {
                // Check if Sequelize CLI is available
                const { exec } = require('child_process');
                exec('npx sequelize-cli db:migrate', (error, stdout, stderr) => {
                    if (error) {
                        console.error('迁移脚本执行错误:', error);
                        console.error('尝试使用内部迁移脚本...');
                    }
                    else {
                        console.log('迁移脚本执行输出:', stdout);
                        if (stderr)
                            console.error('迁移脚本错误输出:', stderr);
                    }
                });
            }
            catch (migrationError) {
                console.error('迁移流程错误:', migrationError);
            }
        }
        // Sync database models if needed
        if (process.env.DB_SYNC === 'true') {
            await database_1.default.sync(syncOptions);
            console.log('数据库模型同步完成');
        }
        // 确保 HomepageSettings 表有初始数据
        try {
            const tableExists = await database_1.default.getQueryInterface().showAllTables()
                .then(tables => tables.includes('homepage_settings'));
            if (!tableExists) {
                console.log('homepage_settings表不存在，正在创建...');
                await database_1.default.getQueryInterface().createTable('homepage_settings', {
                    id: {
                        type: sequelize_1.DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false
                    },
                    welcome_title: {
                        type: sequelize_1.DataTypes.STRING(255),
                        allowNull: false,
                        defaultValue: 'ExamTopics Practice'
                    },
                    welcome_description: {
                        type: sequelize_1.DataTypes.TEXT,
                        allowNull: false,
                        defaultValue: 'Choose any of the following question sets to practice and test your knowledge'
                    },
                    featured_categories: {
                        type: sequelize_1.DataTypes.TEXT,
                        allowNull: true,
                        defaultValue: JSON.stringify(['Network Protocols', 'Programming Languages', 'Computer Basics'])
                    },
                    announcements: {
                        type: sequelize_1.DataTypes.TEXT,
                        allowNull: true,
                        defaultValue: 'Welcome to the online quiz system. New question sets will be updated regularly!'
                    },
                    footer_text: {
                        type: sequelize_1.DataTypes.STRING(255),
                        allowNull: true,
                        defaultValue: '© 2023 ExamTopics Online Quiz System. All rights reserved.'
                    },
                    banner_image: {
                        type: sequelize_1.DataTypes.STRING(255),
                        allowNull: true,
                        defaultValue: '/images/banner.jpg'
                    },
                    theme: {
                        type: sequelize_1.DataTypes.STRING(50),
                        allowNull: true,
                        defaultValue: 'light'
                    },
                    created_at: {
                        type: sequelize_1.DataTypes.DATE,
                        allowNull: false,
                        defaultValue: sequelize_1.Sequelize.literal('CURRENT_TIMESTAMP')
                    },
                    updated_at: {
                        type: sequelize_1.DataTypes.DATE,
                        allowNull: false,
                        defaultValue: sequelize_1.Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
                    }
                });
                // Insert initial record
                await database_1.default.getQueryInterface().bulkInsert('homepage_settings', [{
                        id: 1,
                        welcome_title: "ExamTopics 模拟练习",
                        welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
                        featured_categories: JSON.stringify(["网络协议", "编程语言", "计算机基础"]),
                        announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
                        footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
                        banner_image: "/images/banner.jpg",
                        theme: 'light',
                        created_at: new Date(),
                        updated_at: new Date()
                    }]);
                console.log('homepage_settings表创建并初始化完成');
            }
            HomepageSettings_1.default.findByPk(1).then((homepageSettings) => {
                if (!homepageSettings) {
                    console.log('创建 HomepageSettings 初始数据...');
                    return HomepageSettings_1.default.create({
                        id: 1,
                        welcome_title: "ExamTopics 模拟练习",
                        welcome_description: "选择以下任一题库开始练习，测试您的知识水平",
                        featured_categories: ["网络协议", "编程语言", "计算机基础"],
                        announcements: "欢迎使用在线题库系统，新增题库将定期更新，请持续关注！",
                        footer_text: "© 2023 ExamTopics 在线题库系统 保留所有权利",
                        banner_image: "/images/banner.jpg",
                        theme: 'light'
                    });
                }
            }).then(() => {
                server.listen(PORT, () => {
                    console.log(`Server is running on port ${PORT}`);
                });
            }).catch(error => {
                console.error('HomepageSettings初始化错误:', error);
                // 即使初始化HomepageSettings失败，仍然启动服务器
                server.listen(PORT, () => {
                    console.log(`Server is running on port ${PORT} (degraded mode)`);
                });
            });
        }
        catch (error) {
            console.error('检查HomepageSettings表时出错:', error);
            // 启动服务器，即使HomepageSettings表检查失败
            server.listen(PORT, () => {
                console.log(`Server is running on port ${PORT} (degraded mode)`);
            });
        }
    }
    catch (error) {
        console.error('服务器启动失败:', error);
        // Continue running the server even if database connection fails
        // This allows routes to handle errors gracefully
        server.listen(PORT, () => {
            console.log(`服务器运行在降级模式下 http://localhost:${PORT} (数据库连接失败)`);
            console.log('请运行 node src/scripts/setup-database.js 获取数据库设置帮助');
        });
        // Initialize Socket.IO in degraded mode
        (0, socket_1.initializeSocket)(server, true);
    }
};
// Start the server
startServer();
// 添加进程异常处理，防止因数据库错误导致整个应用崩溃
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    // 不要终止进程，让应用继续运行
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    // 不要终止进程，让应用继续运行
});
exports.default = app;
