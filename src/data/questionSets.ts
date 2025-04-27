import { Question } from './questions';

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: Question[];
  icon: string; // 使用简单的图标名称，可以是emoji或图标类名
  isPaid: boolean; // 是否为付费题库
  price?: number; // 价格（元），只有isPaid为true时才有意义
  trialQuestions?: number; // 免费试用的题目数量，默认为0
  isFeatured?: boolean; // 是否为精选题库
  featuredCategory?: string; // 精选分类
}

export const questionSets: QuestionSet[] = [
  {
    id: 'network',
    title: '网络协议',
    description: '测试你对TCP/IP、HTTP等网络协议的理解',
    category: '计算机基础',
    icon: '🌐',
    isPaid: false, // 免费题库
    questions: [
      {
        id: 1,
        question: "在 TCP/IP 协议栈中，哪一层负责路由选择和数据转发？",
        questionType: 'single',
        options: [
          { id: "A", text: "物理层" },
          { id: "B", text: "数据链路层" },
          { id: "C", text: "网络层" },
          { id: "D", text: "传输层" }
        ],
        correctAnswer: "C",
        explanation: "网络层（Network Layer）负责在不同网络之间传输数据包，实现路由选择和数据转发功能。在 TCP/IP 协议栈中，IP 协议位于网络层，提供了确定源主机和目标主机之间路径的功能。"
      },
      {
        id: 2,
        question: "HTTP协议默认使用的端口号是？",
        questionType: 'single',
        options: [
          { id: "A", text: "21" },
          { id: "B", text: "80" },
          { id: "C", text: "443" },
          { id: "D", text: "8080" }
        ],
        correctAnswer: "B",
        explanation: "HTTP（超文本传输协议）默认使用80端口。HTTPS使用443端口，FTP使用21端口，而8080通常作为HTTP的替代端口。"
      },
      {
        id: 3,
        question: "以下哪些协议工作在应用层？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "HTTP" },
          { id: "B", text: "FTP" },
          { id: "C", text: "TCP" },
          { id: "D", text: "SMTP" },
          { id: "E", text: "IP" }
        ],
        correctAnswer: ["A", "B", "D"],
        explanation: "HTTP、FTP和SMTP都是应用层协议。TCP是传输层协议，IP是网络层协议。"
      },
      {
        id: 4,
        question: "关于HTTP和HTTPS的说法，以下哪些是正确的？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "HTTPS比HTTP更安全" },
          { id: "B", text: "HTTPS使用TLS/SSL加密数据" },
          { id: "C", text: "HTTP默认使用443端口" },
          { id: "D", text: "HTTPS需要证书支持" }
        ],
        correctAnswer: ["A", "B", "D"],
        explanation: "HTTPS确实比HTTP更安全，它使用TLS/SSL加密数据并需要证书支持。HTTP默认使用80端口，而HTTPS默认使用443端口。"
      }
    ]
  },
  {
    id: 'algorithms',
    title: '算法与数据结构',
    description: '测试你对基本算法和数据结构的掌握',
    category: '计算机基础',
    icon: '⚙️',
    isPaid: true, // 付费题库
    price: 39.9, // 39.9元
    trialQuestions: 1, // 可以免费做1道题
    questions: [
      {
        id: 1,
        question: "以下哪种排序算法的平均时间复杂度为 O(n log n)？",
        questionType: 'single',
        options: [
          { id: "A", text: "冒泡排序" },
          { id: "B", text: "插入排序" },
          { id: "C", text: "选择排序" },
          { id: "D", text: "快速排序" }
        ],
        correctAnswer: "D",
        explanation: "快速排序的平均时间复杂度为 O(n log n)，它采用分治策略，通过一个枢轴元素将数组分成两部分，然后递归地对两部分进行排序。冒泡排序、插入排序和选择排序的平均时间复杂度均为 O(n²)。"
      },
      {
        id: 2,
        question: "下列哪种数据结构最适合实现优先队列？",
        questionType: 'single',
        options: [
          { id: "A", text: "栈" },
          { id: "B", text: "链表" },
          { id: "C", text: "堆" },
          { id: "D", text: "二叉搜索树" }
        ],
        correctAnswer: "C",
        explanation: "堆（特别是最小堆或最大堆）是实现优先队列的最佳数据结构，它能够在O(log n)时间内执行插入和删除操作，同时在O(1)时间内获取最高优先级的元素。"
      },
      {
        id: 3,
        question: "以下哪些数据结构是线性的？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "数组" },
          { id: "B", text: "链表" },
          { id: "C", text: "树" },
          { id: "D", text: "栈" },
          { id: "E", text: "图" }
        ],
        correctAnswer: ["A", "B", "D"],
        explanation: "数组、链表和栈是线性数据结构，它们的元素按顺序排列。树和图是非线性数据结构，它们的元素之间有多对多的关系。"
      },
      {
        id: 4,
        question: "关于时间复杂度的描述，以下哪些是正确的？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "O(1) 表示常数时间复杂度" },
          { id: "B", text: "O(n²) 通常比 O(n log n) 效率更高" },
          { id: "C", text: "快速排序的最坏时间复杂度是 O(n²)" },
          { id: "D", text: "二分查找的时间复杂度是 O(log n)" }
        ],
        correctAnswer: ["A", "C", "D"],
        explanation: "O(1)确实表示常数时间复杂度；快速排序最坏情况下是O(n²)；二分查找的时间复杂度是O(log n)。但O(n²)通常比O(n log n)效率低，而不是更高。"
      }
    ]
  },
  {
    id: 'oop',
    title: '面向对象编程',
    description: '测试你对面向对象编程概念的理解',
    category: '编程范式',
    icon: '🧩',
    isPaid: false, // 免费题库
    questions: [
      {
        id: 1,
        question: "在面向对象编程中，下列关于封装的说法哪一项是正确的？",
        questionType: 'single',
        options: [
          { id: "A", text: "封装是将数据和行为绑定在一起，对外部隐藏实现细节" },
          { id: "B", text: "封装主要用于实现多态性" },
          { id: "C", text: "封装是一个类继承另一个类的属性和方法的机制" },
          { id: "D", text: "封装使得不相关的类可以使用相同的接口" }
        ],
        correctAnswer: "A",
        explanation: "封装是面向对象编程的基本原则之一，它指的是将数据和操作数据的方法绑定在一起，对外部隐藏对象的内部实现细节，只暴露必要的接口。这样可以保护对象的内部状态，提高代码的安全性和可维护性。"
      },
      {
        id: 2,
        question: "以下哪个不是面向对象编程的核心概念？",
        questionType: 'single',
        options: [
          { id: "A", text: "封装" },
          { id: "B", text: "继承" },
          { id: "C", text: "多态" },
          { id: "D", text: "递归" }
        ],
        correctAnswer: "D",
        explanation: "面向对象编程的三大核心概念是封装、继承和多态。递归是一种编程技术，是指在函数定义中使用函数自身的方法，与面向对象编程的核心概念无关。"
      },
      {
        id: 3,
        question: "面向对象编程的好处包括哪些？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "提高代码的可重用性" },
          { id: "B", text: "增加程序的可维护性" },
          { id: "C", text: "保证程序的执行效率" },
          { id: "D", text: "简化复杂系统设计" }
        ],
        correctAnswer: ["A", "B", "D"],
        explanation: "面向对象编程增加了代码可重用性、可维护性，并简化了复杂系统的设计。但它并不保证程序的执行效率，有时候面向对象程序可能比过程式编程效率低。"
      },
      {
        id: 4,
        question: "以下哪些概念与多态相关？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "方法重写（Override）" },
          { id: "B", text: "方法重载（Overload）" },
          { id: "C", text: "接口实现" },
          { id: "D", text: "静态绑定" }
        ],
        correctAnswer: ["A", "B", "C"],
        explanation: "方法重写（Override）、方法重载（Overload）和接口实现都是多态的体现。静态绑定与动态绑定相对，而多态通常与动态绑定相关。"
      }
    ]
  },
  {
    id: 'database',
    title: '数据库原理',
    description: '测试你对SQL和数据库概念的理解',
    category: '数据管理',
    icon: '💾',
    isPaid: true, // 付费题库
    price: 29.9, // 29.9元
    trialQuestions: 2, // 可以免费做2道题
    questions: [
      {
        id: 1,
        question: "在关系型数据库中，以下哪个是最高的标准化范式？",
        questionType: 'single',
        options: [
          { id: "A", text: "第一范式(1NF)" },
          { id: "B", text: "第二范式(2NF)" },
          { id: "C", text: "第三范式(3NF)" },
          { id: "D", text: "BC范式(BCNF)" }
        ],
        correctAnswer: "D",
        explanation: "BC范式(BCNF, Boyce-Codd Normal Form)是比第三范式(3NF)更高级的范式，它要求所有决定因素必须是候选键。3NF只要求非主属性对候选键是完全函数依赖的，而BCNF则要求所有属性对候选键都是完全函数依赖的。"
      },
      {
        id: 2,
        question: "以下哪个SQL语句用于从数据库中选择数据？",
        questionType: 'single',
        options: [
          { id: "A", text: "INSERT" },
          { id: "B", text: "SELECT" },
          { id: "C", text: "UPDATE" },
          { id: "D", text: "DELETE" }
        ],
        correctAnswer: "B",
        explanation: "SELECT语句用于从数据库表中检索数据。INSERT用于插入新记录，UPDATE用于修改现有记录，DELETE用于删除记录。"
      },
      {
        id: 3,
        question: "以下哪些属于SQL的DML（数据操作语言）？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "SELECT" },
          { id: "B", text: "INSERT" },
          { id: "C", text: "CREATE" },
          { id: "D", text: "UPDATE" },
          { id: "E", text: "ALTER" }
        ],
        correctAnswer: ["A", "B", "D"],
        explanation: "DML（数据操作语言）包括SELECT、INSERT、UPDATE和DELETE。CREATE和ALTER属于DDL（数据定义语言）。"
      },
      {
        id: 4,
        question: "关于索引的说法，以下哪些是正确的？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "索引可以加快数据检索速度" },
          { id: "B", text: "索引会降低INSERT和UPDATE操作的性能" },
          { id: "C", text: "主键自动创建索引" },
          { id: "D", text: "索引不占用额外的磁盘空间" }
        ],
        correctAnswer: ["A", "B", "C"],
        explanation: "索引确实可以加快数据检索速度，但会降低INSERT和UPDATE操作的性能，因为索引需要同步更新。主键确实会自动创建索引。但索引会占用额外的磁盘空间，用来存储索引结构。"
      }
    ]
  },
  {
    id: 'frontend',
    title: '前端开发',
    description: '测试你对HTML、CSS和JavaScript的理解',
    category: '网页开发',
    icon: '🌈',
    isPaid: false, // 免费题库
    questions: [
      {
        id: 1,
        question: "在HTML中，哪个元素用于定义页面的主要内容区域？",
        questionType: 'single',
        options: [
          { id: "A", text: "<header>" },
          { id: "B", text: "<main>" },
          { id: "C", text: "<section>" },
          { id: "D", text: "<article>" }
        ],
        correctAnswer: "B",
        explanation: "<main>元素表示文档的主要内容区域，这个区域应包含文档特有的内容，不包括如导航链接、版权信息、侧边栏等可能在多个文档中重复出现的内容。"
      },
      {
        id: 2,
        question: "在CSS中，使用哪种选择器可以选择某元素的直接子元素？",
        questionType: 'single',
        options: [
          { id: "A", text: "后代选择器 (空格)" },
          { id: "B", text: "相邻兄弟选择器 (+)" },
          { id: "C", text: "子选择器 (>)" },
          { id: "D", text: "通用兄弟选择器 (~)" }
        ],
        correctAnswer: "C",
        explanation: "子选择器 '>' 用于选择元素的直接子元素。例如，'div > p' 会选择直接父元素是 div 的所有 p 元素。"
      },
      {
        id: 3,
        question: "以下哪些是JavaScript的数据类型？",
        questionType: 'multiple',
        options: [
          { id: "A", text: "String" },
          { id: "B", text: "Number" },
          { id: "C", text: "Character" },
          { id: "D", text: "Object" },
          { id: "E", text: "Integer" }
        ],
        correctAnswer: ["A", "B", "D"],
        explanation: "JavaScript的基本数据类型包括String、Number、Boolean、Undefined、Null、Symbol和BigInt，以及Object引用类型。JavaScript没有Character和Integer单独的类型，Character属于String，Integer属于Number。"
      }
    ]
  }
]; 