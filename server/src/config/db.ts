/**
 * 兼容性文件 - 重新导出 database.ts 的内容
 * 此文件解决编译后路径不一致的问题
 */

import sequelize from './database';

export default sequelize;
export * from './database'; 