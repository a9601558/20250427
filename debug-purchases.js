// 临时调试文件 - 用于检查购买记录问题
// 将此代码在浏览器控制台运行来检查用户购买记录状态

window.debugPurchases = function() {
  console.log('=== 购买记录调试信息 ===');
  
  // 检查本地存储
  const token = localStorage.getItem('token');
  console.log('Token存在:', !!token);
  
  // 检查用户状态
  if (window.userContextState) {
    const user = window.userContextState.user;
    console.log('用户信息:', user);
    
    if (user && user.purchases) {
      console.log('购买记录数量:', user.purchases.length);
      user.purchases.forEach((purchase, index) => {
        console.log(`购买记录 ${index + 1}:`, {
          questionSetId: purchase.questionSetId,
          status: purchase.status,
          paymentMethod: purchase.paymentMethod,
          expiryDate: purchase.expiryDate,
          isExpired: purchase.expiryDate ? new Date(purchase.expiryDate) <= new Date() : false
        });
      });
    } else {
      console.log('用户没有购买记录');
    }
    
    // 检查本地缓存
    const cacheKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('access_') || key.includes('questionSet')
    );
    console.log('本地缓存记录:', cacheKeys);
    cacheKeys.forEach(key => {
      console.log(`${key}:`, localStorage.getItem(key));
    });
  } else {
    console.log('用户上下文未找到');
  }
  
  console.log('=== 调试结束 ===');
};

console.log('调试函数已加载，在控制台运行 debugPurchases() 来检查购买记录状态');