/**
 * 应用程序全局状态管理
 * 用于跟踪应用级别的状态，例如初始化状态
 */

class AppState {
  private static _instance: AppState;
  private _associationsInitialized: boolean = false;
  
  private constructor() {
    // 私有构造函数，防止直接实例化
  }
  
  /**
   * 获取单例实例
   */
  public static getInstance(): AppState {
    if (!AppState._instance) {
      AppState._instance = new AppState();
    }
    return AppState._instance;
  }
  
  /**
   * 检查模型关联是否已初始化
   */
  public get associationsInitialized(): boolean {
    return this._associationsInitialized;
  }
  
  /**
   * 设置模型关联初始化状态
   */
  public set associationsInitialized(value: boolean) {
    this._associationsInitialized = value;
  }
  
  /**
   * 将应用状态重置为初始值
   * 主要用于测试目的
   */
  public reset(): void {
    this._associationsInitialized = false;
  }
}

// 导出单例实例
export const appState = AppState.getInstance(); 