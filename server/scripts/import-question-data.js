const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'exam_practice',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 题库数据
const questionSets = [
  {
    title: "计算机网络基础",
    description: "测试您对计算机网络基础知识的掌握程度，包括OSI模型、TCP/IP协议、网络设备等内容。",
    category: "计算机科学",
    icon: "network",
    isPaid: true,
    price: 29.9,
    trialQuestions: 3,
    questions: [
      {
        text: "OSI模型有几层？",
        explanation: "OSI(开放系统互连)模型共有七层，分别是物理层、数据链路层、网络层、传输层、会话层、表示层和应用层。",
        options: [
          { text: "5层", isCorrect: false },
          { text: "6层", isCorrect: false },
          { text: "7层", isCorrect: true },
          { text: "4层", isCorrect: false }
        ]
      },
      {
        text: "以下哪个协议工作在传输层？",
        explanation: "TCP(传输控制协议)和UDP(用户数据报协议)都工作在传输层。",
        options: [
          { text: "HTTP", isCorrect: false },
          { text: "TCP", isCorrect: true },
          { text: "IP", isCorrect: false },
          { text: "Ethernet", isCorrect: false }
        ]
      },
      {
        text: "以下哪个IP地址是私有地址？",
        explanation: "私有IP地址范围包括：10.0.0.0/8、172.16.0.0/12和192.168.0.0/16。",
        options: [
          { text: "8.8.8.8", isCorrect: false },
          { text: "192.168.1.1", isCorrect: true },
          { text: "203.0.113.1", isCorrect: false },
          { text: "169.254.1.1", isCorrect: false }
        ]
      },
      {
        text: "HTTP默认端口号是多少？",
        explanation: "HTTP协议默认使用80端口，而HTTPS默认使用443端口。",
        options: [
          { text: "80", isCorrect: true },
          { text: "443", isCorrect: false },
          { text: "8080", isCorrect: false },
          { text: "21", isCorrect: false }
        ]
      },
      {
        text: "以下哪种设备工作在网络层？",
        explanation: "路由器工作在网络层(第3层)，负责数据包的路由和转发。",
        options: [
          { text: "集线器", isCorrect: false },
          { text: "交换机", isCorrect: false },
          { text: "路由器", isCorrect: true },
          { text: "调制解调器", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "数据库基础知识",
    description: "测试您对数据库基础知识的理解，包括SQL语法、数据库设计和优化等内容。",
    category: "数据库",
    icon: "database",
    isPaid: true,
    price: 39.9,
    trialQuestions: 2,
    questions: [
      {
        text: "以下哪个不是SQL的DML语句？",
        explanation: "CREATE属于DDL(数据定义语言)，而INSERT、UPDATE和DELETE都属于DML(数据操作语言)。",
        options: [
          { text: "INSERT", isCorrect: false },
          { text: "UPDATE", isCorrect: false },
          { text: "DELETE", isCorrect: false },
          { text: "CREATE", isCorrect: true }
        ]
      },
      {
        text: "关系型数据库中，多对多关系通常如何实现？",
        explanation: "多对多关系通常通过创建中间表或连接表来实现，该表包含两个实体的外键。",
        options: [
          { text: "通过外键约束", isCorrect: false },
          { text: "通过中间表", isCorrect: true },
          { text: "通过嵌套对象", isCorrect: false },
          { text: "通过视图", isCorrect: false }
        ]
      },
      {
        text: "SQL中如何对查询结果去重？",
        explanation: "在SELECT语句中使用DISTINCT关键字可以去除结果集中的重复行。",
        options: [
          { text: "使用UNIQUE关键字", isCorrect: false },
          { text: "使用DISTINCT关键字", isCorrect: true },
          { text: "使用GROUP BY子句", isCorrect: false },
          { text: "使用DIFFERENT关键字", isCorrect: false }
        ]
      },
      {
        text: "MySQL中哪个引擎不支持事务？",
        explanation: "MyISAM引擎不支持事务，而InnoDB引擎支持事务并符合ACID特性。",
        options: [
          { text: "InnoDB", isCorrect: false },
          { text: "MyISAM", isCorrect: true },
          { text: "XtraDB", isCorrect: false },
          { text: "TokuDB", isCorrect: false }
        ]
      },
      {
        text: "以下哪个不是数据库索引类型？",
        explanation: "迭代索引不是标准的数据库索引类型。常见的索引类型包括B树索引、哈希索引、全文索引等。",
        options: [
          { text: "B树索引", isCorrect: false },
          { text: "哈希索引", isCorrect: false },
          { text: "全文索引", isCorrect: false },
          { text: "迭代索引", isCorrect: true }
        ]
      }
    ]
  },
  {
    title: "JavaScript编程基础",
    description: "测试您对JavaScript编程语言的基础知识，包括语法、数据类型、函数和DOM操作等。",
    category: "编程语言",
    icon: "code",
    isPaid: false,
    price: 0,
    trialQuestions: 0,
    questions: [
      {
        text: "以下哪个不是JavaScript原始数据类型？",
        explanation: "JavaScript的原始数据类型包括string、number、boolean、null、undefined、symbol和bigint。Array是引用类型，不是原始类型。",
        options: [
          { text: "String", isCorrect: false },
          { text: "Number", isCorrect: false },
          { text: "Boolean", isCorrect: false },
          { text: "Array", isCorrect: true }
        ]
      },
      {
        text: "以下哪个方法用于动态创建HTML元素？",
        explanation: "document.createElement()方法用于创建一个新的HTML元素。",
        options: [
          { text: "document.appendElement()", isCorrect: false },
          { text: "document.createElement()", isCorrect: true },
          { text: "document.makeElement()", isCorrect: false },
          { text: "document.newElement()", isCorrect: false }
        ]
      },
      {
        text: "JavaScript中如何声明常量？",
        explanation: "使用const关键字声明的变量不能重新赋值，适合用于常量的声明。",
        options: [
          { text: "使用var关键字", isCorrect: false },
          { text: "使用let关键字", isCorrect: false },
          { text: "使用const关键字", isCorrect: true },
          { text: "使用static关键字", isCorrect: false }
        ]
      },
      {
        text: "以下哪个事件会在页面完全加载后触发？",
        explanation: "window.onload事件会在页面所有内容(包括图片、样式表等)加载完成后触发。",
        options: [
          { text: "window.onload", isCorrect: true },
          { text: "document.ready", isCorrect: false },
          { text: "document.onstart", isCorrect: false },
          { text: "window.onstart", isCorrect: false }
        ]
      },
      {
        text: "JavaScript中的闭包是什么？",
        explanation: "闭包是一个函数与其词法环境的组合，使函数可以访问创建它的作用域中的变量。",
        options: [
          { text: "一种数据类型", isCorrect: false },
          { text: "一种循环结构", isCorrect: false },
          { text: "一个可以访问外部函数作用域的内部函数", isCorrect: true },
          { text: "一种错误处理机制", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "Python编程入门",
    description: "适合Python初学者的基础知识测试，包括语法、数据类型、控制流和函数等。",
    category: "编程语言",
    icon: "python",
    isPaid: true,
    price: 19.9,
    trialQuestions: 2,
    questions: [
      {
        text: "Python中注释使用什么符号？",
        explanation: "Python中单行注释使用#符号，多行注释可以使用三重引号'''或\"\"\"。",
        options: [
          { text: "//", isCorrect: false },
          { text: "/* */", isCorrect: false },
          { text: "#", isCorrect: true },
          { text: "--", isCorrect: false }
        ]
      },
      {
        text: "Python中如何定义函数？",
        explanation: "Python使用def关键字定义函数，后跟函数名和参数列表。",
        options: [
          { text: "使用function关键字", isCorrect: false },
          { text: "使用def关键字", isCorrect: true },
          { text: "使用fun关键字", isCorrect: false },
          { text: "使用method关键字", isCorrect: false }
        ]
      },
      {
        text: "以下哪个不是Python的内置数据类型？",
        explanation: "Array不是Python的内置数据类型，类似功能可以使用list(列表)来实现。",
        options: [
          { text: "List", isCorrect: false },
          { text: "Dictionary", isCorrect: false },
          { text: "Tuple", isCorrect: false },
          { text: "Array", isCorrect: true }
        ]
      },
      {
        text: "Python中如何导入模块？",
        explanation: "使用import语句可以导入模块，例如'import math'导入数学模块。",
        options: [
          { text: "使用require语句", isCorrect: false },
          { text: "使用include语句", isCorrect: false },
          { text: "使用import语句", isCorrect: true },
          { text: "使用load语句", isCorrect: false }
        ]
      },
      {
        text: "Python中列表的索引从几开始？",
        explanation: "Python中，列表和大多数编程语言一样，索引从0开始。",
        options: [
          { text: "0", isCorrect: true },
          { text: "1", isCorrect: false },
          { text: "-1", isCorrect: false },
          { text: "没有固定起始索引", isCorrect: false }
        ]
      }
    ]
  },
  {
    title: "Web前端开发基础",
    description: "测试您对HTML、CSS和JavaScript等前端技术的基础知识。",
    category: "Web开发",
    icon: "web",
    isPaid: true,
    price: 24.9,
    trialQuestions: 3,
    questions: [
      {
        text: "HTML5中哪个标签用于定义导航链接？",
        explanation: "HTML5中<nav>标签用于定义导航链接部分。",
        options: [
          { text: "<navigation>", isCorrect: false },
          { text: "<menu>", isCorrect: false },
          { text: "<nav>", isCorrect: true },
          { text: "<navbar>", isCorrect: false }
        ]
      },
      {
        text: "CSS中，以下哪个选择器的优先级最高？",
        explanation: "内联样式(style属性)的优先级最高，其次是ID选择器、类选择器和标签选择器。",
        options: [
          { text: "元素选择器", isCorrect: false },
          { text: "类选择器", isCorrect: false },
          { text: "ID选择器", isCorrect: false },
          { text: "内联样式", isCorrect: true }
        ]
      },
      {
        text: "以下哪个不是有效的CSS布局模型？",
        explanation: "Dynamic Flow不是标准的CSS布局模型。标准的布局模型包括Flow、Flexbox、Grid等。",
        options: [
          { text: "Flexbox", isCorrect: false },
          { text: "Grid", isCorrect: false },
          { text: "Flow", isCorrect: false },
          { text: "Dynamic Flow", isCorrect: true }
        ]
      },
      {
        text: "在JavaScript中，以下哪个方法用于处理异步操作？",
        explanation: "Promise是JavaScript中处理异步操作的一种机制，可以解决回调地狱问题。",
        options: [
          { text: "setTimeout()", isCorrect: false },
          { text: "Promise()", isCorrect: true },
          { text: "async()", isCorrect: false },
          { text: "wait()", isCorrect: false }
        ]
      },
      {
        text: "响应式设计中，以下哪个不是常用的断点宽度？",
        explanation: "1024px不是常用的响应式设计断点。常用的断点通常包括768px(平板)、576px(手机横屏)和375px(手机竖屏)等。",
        options: [
          { text: "768px", isCorrect: false },
          { text: "576px", isCorrect: false },
          { text: "375px", isCorrect: false },
          { text: "1024px", isCorrect: true }
        ]
      }
    ]
  }
];

// 再生成15个题库，凑够20个
const categories = ["编程语言", "数据库", "Web开发", "网络安全", "人工智能", "操作系统", "云计算", "软件工程", "数据结构", "区块链"];
const icons = ["code", "database", "web", "security", "ai", "os", "cloud", "engineering", "datastructure", "blockchain"];

// 生成随机题库
for (let i = 0; i < 15; i++) {
  const categoryIndex = Math.floor(Math.random() * categories.length);
  const isPaid = Math.random() > 0.3; // 70%概率是付费题库
  const trialQuestions = isPaid ? Math.floor(Math.random() * 3) + 1 : 0;
  
  const questionSet = {
    title: `${categories[categoryIndex]}专题 #${i+1}`,
    description: `这是一个关于${categories[categoryIndex]}的专题测试，测试您对该领域的掌握程度。`,
    category: categories[categoryIndex],
    icon: icons[categoryIndex % icons.length],
    isPaid: isPaid,
    price: isPaid ? (Math.floor(Math.random() * 40) + 10 + Math.random()).toFixed(1) : 0,
    trialQuestions: trialQuestions,
    questions: []
  };
  
  // 每个题库生成5个问题
  for (let j = 0; j < 5; j++) {
    const question = {
      text: `${categories[categoryIndex]}问题 #${j+1}：这是一个测试问题？`,
      explanation: `这是问题#${j+1}的详细解答，介绍了相关知识点和解题思路。`,
      options: [
        { text: "选项A", isCorrect: j % 4 === 0 },
        { text: "选项B", isCorrect: j % 4 === 1 },
        { text: "选项C", isCorrect: j % 4 === 2 },
        { text: "选项D", isCorrect: j % 4 === 3 }
      ]
    };
    questionSet.questions.push(question);
  }
  
  questionSets.push(questionSet);
}

// 插入数据到数据库
async function importData() {
  try {
    // 创建连接池
    const pool = mysql.createPool(dbConfig);
    console.log('数据库连接成功');

    // 开始导入数据
    console.log('开始导入题库数据...');
    
    // 循环处理每个题库
    for (const questionSet of questionSets) {
      const questionSetId = uuidv4();
      
      // 插入题库
      await pool.execute(
        'INSERT INTO question_sets (id, title, description, category, icon, is_paid, price, trial_questions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [questionSetId, questionSet.title, questionSet.description, questionSet.category, questionSet.icon, questionSet.isPaid ? 1 : 0, questionSet.price, questionSet.trialQuestions]
      );
      
      console.log(`已导入题库: ${questionSet.title}`);
      
      // 插入题目和选项
      for (const question of questionSet.questions) {
        const questionId = uuidv4();
        
        // 插入题目
        await pool.execute(
          'INSERT INTO questions (id, question_set_id, text, explanation) VALUES (?, ?, ?, ?)',
          [questionId, questionSetId, question.text, question.explanation]
        );
        
        // 插入选项
        for (const option of question.options) {
          const optionId = uuidv4();
          await pool.execute(
            'INSERT INTO options (id, question_id, text, is_correct) VALUES (?, ?, ?, ?)',
            [optionId, questionId, option.text, option.isCorrect ? 1 : 0]
          );
        }
      }
      
      console.log(`已导入题库 "${questionSet.title}" 的全部${questionSet.questions.length}个问题`);
    }
    
    console.log('数据导入完成！共导入了', questionSets.length, '个题库');
    await pool.end();
    
  } catch (error) {
    console.error('导入数据出错:', error);
    process.exit(1);
  }
}

// 执行导入
importData(); 