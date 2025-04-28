"use strict";
/**
 * 应用程序全局状态管理
 * 用于跟踪应用级别的状态，例如初始化状态
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appState = void 0;
class AppState {
    static _instance;
    _associationsInitialized = false;
    constructor() {
        // 私有构造函数，防止直接实例化
    }
    /**
     * 获取单例实例
     */
    static getInstance() {
        if (!AppState._instance) {
            AppState._instance = new AppState();
        }
        return AppState._instance;
    }
    /**
     * 检查模型关联是否已初始化
     */
    get associationsInitialized() {
        return this._associationsInitialized;
    }
    /**
     * 设置模型关联初始化状态
     */
    set associationsInitialized(value) {
        this._associationsInitialized = value;
    }
    /**
     * 将应用状态重置为初始值
     * 主要用于测试目的
     */
    reset() {
        this._associationsInitialized = false;
    }
}
// 导出单例实例
exports.appState = AppState.getInstance();
