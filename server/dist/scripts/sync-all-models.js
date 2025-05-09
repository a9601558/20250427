"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const associations_1 = require("../models/associations");
const User_1 = __importDefault(require("../models/User"));
const Question_1 = __importDefault(require("../models/Question"));
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const Purchase_1 = __importDefault(require("../models/Purchase"));
const RedeemCode_1 = __importDefault(require("../models/RedeemCode"));
const Option_1 = __importDefault(require("../models/Option"));
const HomepageSettings_1 = __importDefault(require("../models/HomepageSettings"));
const UserProgress_1 = __importDefault(require("../models/UserProgress"));
const defaultSettings_1 = require("../config/defaultSettings");
// 确保所有模型都被导入和注册
const models = [
    User_1.default,
    Question_1.default,
    QuestionSet_1.default,
    Purchase_1.default,
    RedeemCode_1.default,
    Option_1.default,
    HomepageSettings_1.default,
    UserProgress_1.default
];
console.log(`将同步以下 ${models.length} 个模型:`);
models.forEach(model => {
    console.log(` - ${model.name}`);
});
async function syncAllModels() {
    try {
        console.log('✅ 初始化模型关联...');
        (0, associations_1.setupAssociations)();
        console.log('✅ 开始同步所有模型到数据库 (force: true)...');
        await database_1.default.sync({ force: true });
        console.log('🎉 所有数据库表已成功创建！');
        // 创建默认HomepageSettings
        try {
            const [homepageSettings, created] = await HomepageSettings_1.default.findOrCreate({
                where: { id: 1 },
                defaults: defaultSettings_1.defaultHomepageSettings
            });
            if (created) {
                console.log('✅ 默认首页设置已创建！');
            }
            else {
                console.log('ℹ️ 默认首页设置已存在，无需创建');
            }
        }
        catch (error) {
            console.error('❌ 创建首页设置时出错:', error);
        }
        // 打印所有创建的表
        const tables = await database_1.default.getQueryInterface().showAllTables();
        console.log('📋 已创建的表:');
        tables.forEach((table) => {
            console.log(` - ${table}`);
        });
        console.log('🏁 数据库同步完成！');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ 同步模型时出错:', error);
        process.exit(1);
    }
}
// 启动同步流程
syncAllModels();
