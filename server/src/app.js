// 在路由配置部分添加首页内容路由
// ... 其他路由导入
const homepageRoutes = require('./routes/homepageRoutes');

// ... 其他中间件配置

// API路由
app.use('/api/users', userRoutes);
app.use('/api/question-sets', questionSetRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/user-progress', userProgressRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/redeem-codes', redeemCodeRoutes);
app.use('/api/wrong-answers', wrongAnswerRoutes);
app.use('/api/homepage', homepageRoutes); // 添加首页内容路由 
