/**
 * 用户进度测试工具
 * 用于验证用户登录/登出时进度数据是否正确重置
 */

/**
 * 监控用户进度状态变化
 * 在控制台中使用此函数来监视进度状态的切换
 */
export const monitorUserProgress = () => {
  let prevUser: any = null;
  let prevProgressStats: any = {};
  
  // 使用localStorage事件来捕获登录状态变化
  window.addEventListener('storage', (event) => {
    if (event.key === 'token') {
      console.log('[进度监控] 用户登录状态变化:', {
        prevToken: event.oldValue,
        newToken: event.newValue,
      });
    }
  });

  // 周期性检查用户和进度状态
  const intervalId = setInterval(() => {
    try {
      // 从React开发者工具中获取上下文状态
      // 注意: 这仅适用于开发环境
      const reactDevTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (!reactDevTools) return;
      
      const userContextInstance: any = Array.from(reactDevTools.renderers.values())
        .flatMap((renderer: any) => 
          Array.from(renderer.getIDForNodeHandle?.() || [])
            .filter((fiber: any) => 
              fiber?.memoizedState?.tag === 'UserContext'
            )
        )[0];
        
      const progressContextInstance: any = Array.from(reactDevTools.renderers.values())
        .flatMap((renderer: any) => 
          Array.from(renderer.getIDForNodeHandle?.() || [])
            .filter((fiber: any) => 
              fiber?.memoizedState?.tag === 'UserProgressContext'
            )
        )[0];
        
      if (!userContextInstance || !progressContextInstance) return;
      
      const currentUser = userContextInstance.memoizedState.user;
      const currentProgressStats = progressContextInstance.memoizedState.progressStats;
      
      // 检查用户变化
      if (currentUser?.id !== prevUser?.id) {
        console.log('[进度监控] 用户切换:', {
          prevUserId: prevUser?.id,
          newUserId: currentUser?.id,
        });
        
        // 检查进度是否被重置
        if (currentUser && Object.keys(currentProgressStats || {}).length > 0) {
          console.log('[进度监控] 新用户的进度状态:', currentProgressStats);
        }
        
        prevUser = currentUser;
      }
      
      // 检查进度变化
      const prevKeys = Object.keys(prevProgressStats || {});
      const currentKeys = Object.keys(currentProgressStats || {});
      
      if (
        prevKeys.length !== currentKeys.length ||
        prevKeys.some(key => !currentKeys.includes(key)) ||
        currentKeys.some(key => !prevKeys.includes(key))
      ) {
        console.log('[进度监控] 进度键变化:', {
          prevKeys,
          currentKeys,
          添加的键: currentKeys.filter(key => !prevKeys.includes(key)),
          移除的键: prevKeys.filter(key => !currentKeys.includes(key)),
        });
      }
      
      prevProgressStats = currentProgressStats;
    } catch (error) {
      console.error('[进度监控] 错误:', error);
    }
  }, 1000);
  
  // 返回清理函数
  return () => {
    clearInterval(intervalId);
    console.log('[进度监控] 已停止');
  };
};

/**
 * 手动测试用户登出-登录过程中的进度处理
 * 在控制台中调用此函数，按照提示操作
 */
export const testUserProgressReset = async () => {
  console.log('=== 用户进度重置测试 ===');
  console.log('步骤 1: 请先登录一个用户');
  console.log('步骤 2: 访问几个题库来产生进度数据');
  console.log('步骤 3: 在控制台输入 window.continueProgressTest()');
  
  // 添加继续测试的函数到全局
  (window as any).continueProgressTest = () => {
    console.log('=== 测试继续 ===');
    console.log('当前用户进度数据:');
    
    try {
      // 获取当前进度
      const userProgressContext = (window as any).__UserProgressContext;
      console.log('进度统计:', userProgressContext?.progressStats);
      
      console.log('步骤 4: 现在请登出当前用户');
      console.log('步骤 5: 在控制台输入 window.checkProgressAfterLogout()');
      
      // 添加登出后检查函数
      (window as any).checkProgressAfterLogout = () => {
        console.log('=== 登出后检查 ===');
        
        try {
          console.log('登出后进度状态:', userProgressContext?.progressStats);
          console.log('如果进度已清空 (空对象)，测试通过 ✅');
          console.log('如果进度未清空，测试失败 ❌');
          
          console.log('步骤 6: 现在请登录另一个用户');
          console.log('步骤 7: 在控制台输入 window.checkProgressAfterLogin()');
          
          // 添加登录后检查函数
          (window as any).checkProgressAfterLogin = () => {
            console.log('=== 登录新用户后检查 ===');
            
            try {
              console.log('登录新用户后进度状态:', userProgressContext?.progressStats);
              console.log('提示: 新数据应该只包含新用户的进度，不应包含前一个用户的任何数据');
              
              console.log('测试完成，请检查结果是否符合预期');
            } catch (error) {
              console.error('登录后检查错误:', error);
            }
          };
        } catch (error) {
          console.error('登出后检查错误:', error);
        }
      };
    } catch (error) {
      console.error('获取当前进度错误:', error);
    }
  };
  
  console.log('请按照上述步骤操作...');
};

// 导出测试工具
export default {
  monitorUserProgress,
  testUserProgressReset
}; 