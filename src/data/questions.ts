export interface Option {
  id: string;
  text: string;
}

export type QuestionType = 'single' | 'multiple';

export interface Question {
  id: number;
  question: string;
  options: Option[];
  questionType: QuestionType;
  correctAnswer: string | string[]; // 单选题为字符串，多选题为字符串数组
  explanation: string;
}

export const questions: Question[] = [
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
    id: 3,
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
  }
]; 