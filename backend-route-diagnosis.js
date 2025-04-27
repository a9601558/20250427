/**
 * 后端路由诊断工具
 * 将此文件放在您的后端项目根目录，然后运行：
 * node backend-route-diagnosis.js
 */

const fs = require('fs');
const path = require('path');

// 主要检查项目
const checkItems = {
  routesDirectory: false,
  userRoutesFile: false,
  userRegisterRoute: false,
  apiPrefixInRoutes: false,
  indexApiPrefix: false,
  controllerExists: false
};

// 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}==== 后端路由诊断工具 ====${colors.reset}`);

// 1. 检查项目结构
console.log(`\n${colors.cyan}1. 检查项目结构${colors.reset}`);

// 检查routes目录
const routesDir = path.join(process.cwd(), 'src', 'routes');
if (fs.existsSync(routesDir)) {
  console.log(`${colors.green}✓ routes目录存在: ${routesDir}${colors.reset}`);
  checkItems.routesDirectory = true;
  
  // 检查userRoutes.js/ts文件
  const userRoutesFile = fs.readdirSync(routesDir).find(file => 
    file.includes('userRoutes') || file.includes('UserRoutes')
  );
  
  if (userRoutesFile) {
    console.log(`${colors.green}✓ 用户路由文件存在: ${userRoutesFile}${colors.reset}`);
    checkItems.userRoutesFile = true;
    
    // 读取路由文件内容
    const userRoutesPath = path.join(routesDir, userRoutesFile);
    const userRoutesContent = fs.readFileSync(userRoutesPath, 'utf8');
    
    // 检查注册路由
    if (userRoutesContent.includes('/register') || userRoutesContent.includes('register')) {
      console.log(`${colors.green}✓ 用户注册路由定义存在${colors.reset}`);
      checkItems.userRegisterRoute = true;
    } else {
      console.log(`${colors.red}✗ 没有找到用户注册路由定义${colors.reset}`);
    }
    
    // 检查API前缀
    if (userRoutesContent.includes('/api/') || userRoutesContent.includes("'/api")) {
      console.log(`${colors.green}✓ 路由文件中包含/api前缀${colors.reset}`);
      checkItems.apiPrefixInRoutes = true;
    } else {
      console.log(`${colors.yellow}! 路由文件中没有找到/api前缀${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✗ 没有找到用户路由文件${colors.reset}`);
  }
} else {
  console.log(`${colors.red}✗ routes目录不存在: ${routesDir}${colors.reset}`);
}

// 2. 检查主要入口文件
console.log(`\n${colors.cyan}2. 检查应用入口文件${colors.reset}`);

// 检查index.js/ts
const indexFiles = ['index.js', 'index.ts', 'app.js', 'app.ts', 'server.js', 'server.ts'];
let indexFile;

for (const file of indexFiles) {
  const filePath = path.join(process.cwd(), 'src', file);
  if (fs.existsSync(filePath)) {
    indexFile = filePath;
    console.log(`${colors.green}✓ 找到入口文件: ${file}${colors.reset}`);
    
    // 读取文件内容
    const indexContent = fs.readFileSync(filePath, 'utf8');
    
    // 检查API前缀
    if (indexContent.includes('/api/users') || indexContent.includes('/api/')) {
      console.log(`${colors.green}✓ 入口文件中包含/api前缀${colors.reset}`);
      checkItems.indexApiPrefix = true;
    } else {
      console.log(`${colors.yellow}! 入口文件中没有找到/api前缀${colors.reset}`);
    }
    
    break;
  }
}

if (!indexFile) {
  console.log(`${colors.red}✗ 没有找到入口文件${colors.reset}`);
}

// 3. 检查控制器
console.log(`\n${colors.cyan}3. 检查控制器${colors.reset}`);

const controllersDir = path.join(process.cwd(), 'src', 'controllers');
if (fs.existsSync(controllersDir)) {
  console.log(`${colors.green}✓ controllers目录存在: ${controllersDir}${colors.reset}`);
  
  // 检查userController.js/ts文件
  const userControllerFile = fs.readdirSync(controllersDir).find(file => 
    file.includes('userController') || file.includes('UserController')
  );
  
  if (userControllerFile) {
    console.log(`${colors.green}✓ 用户控制器文件存在: ${userControllerFile}${colors.reset}`);
    checkItems.controllerExists = true;
    
    // 读取控制器文件内容
    const userControllerPath = path.join(controllersDir, userControllerFile);
    const userControllerContent = fs.readFileSync(userControllerPath, 'utf8');
    
    // 检查registerUser函数
    if (userControllerContent.includes('registerUser') || userControllerContent.includes('register')) {
      console.log(`${colors.green}✓ 用户注册控制器函数存在${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ 没有找到用户注册控制器函数${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✗ 没有找到用户控制器文件${colors.reset}`);
  }
} else {
  console.log(`${colors.red}✗ controllers目录不存在: ${controllersDir}${colors.reset}`);
}

// 4. 诊断结果
console.log(`\n${colors.cyan}4. 诊断结果与建议${colors.reset}`);

// 诊断
if (!checkItems.userRegisterRoute) {
  console.log(`${colors.red}问题: 没有找到用户注册路由定义${colors.reset}`);
  console.log(`建议: 在路由文件中添加注册路由，例如：`);
  console.log(`router.post('/register', registerUser);`);
}

if (!checkItems.apiPrefixInRoutes && !checkItems.indexApiPrefix) {
  console.log(`${colors.red}问题: 路由定义中可能没有包含/api前缀${colors.reset}`);
  console.log(`建议: 确认路由前缀是否与Nginx配置匹配`);
  console.log(`- Nginx已配置为保留/api前缀: proxy_pass http://127.0.0.1:5000/api/`);
  console.log(`- 后端路由应该相应注册在/api下，或者在入口文件中添加前缀`);
}

// 综合建议
console.log(`\n${colors.cyan}5. 路由处理建议${colors.reset}`);

if (checkItems.userRoutesFile && checkItems.indexApiPrefix) {
  console.log(`以下是一个推荐的路由设置示例：`);
  console.log(`\n在index.js/app.js中：`);
  console.log(`app.use('/api/users', userRoutes); // 注册用户路由`);
  
  console.log(`\n在userRoutes.js中：`);
  console.log(`// 无需添加/api前缀，因为入口文件已添加`);
  console.log(`router.post('/register', userController.registerUser);`);
  console.log(`router.post('/login', userController.loginUser);`);
} else if (checkItems.userRoutesFile) {
  console.log(`以下是一个推荐的路由设置示例：`);
  console.log(`\n在userRoutes.js中：`);
  console.log(`// 直接在路由中包含完整路径`);
  console.log(`router.post('/api/users/register', userController.registerUser);`);
  console.log(`router.post('/api/users/login', userController.loginUser);`);
}

console.log(`\n${colors.cyan}执行以下命令测试路由：${colors.reset}`);
console.log(`curl -X POST -H "Content-Type: application/json" -d '{"username":"test","password":"test123","email":"test@example.com"}' http://localhost:5000/api/users/register -v`); 