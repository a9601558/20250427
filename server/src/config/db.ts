/**
 * 兼容性文件 - 重新导出 database.ts 的内容
 * 此文件解决编译后路径不一致的问题
 */

import sequelize from './database';

// ES Module 导出
export default sequelize;
export * from './database';

// CommonJS 兼容性导出
// @ts-ignore
module.exports = sequelize;
// @ts-ignore
module.exports.default = sequelize; 
