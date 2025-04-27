/**
 * 修复题目添加问题 - 直接替换更新函数
 */

// 添加一个预处理函数来标准化前端传来的数据格式
function normalizeQuestionData(questions) {
  if (!Array.isArray(questions)) {
    console.warn('questions is not an array');
    return [];
  }
  
  return questions
    .filter(q => q) // 过滤掉null和undefined
    .map((q, index) => {
      // 确保text字段不为null
      const questionText = q.text || q.question || `问题 ${index + 1}`;
      const explanation = q.explanation || '暂无解析';
      
      // 标准化问题数据
      const normalizedQuestion = {
        text: questionText,
        explanation: explanation,
        questionType: q.questionType || 'single',
        orderIndex: q.orderIndex !== undefined ? q.orderIndex : index,
        options: []
      };
      
      // 处理选项
      if (Array.isArray(q.options)) {
        normalizedQuestion.options = q.options
          .filter(opt => opt) // 过滤掉null和undefined
          .map((opt, j) => {
            const optionText = opt.text || `选项 ${String.fromCharCode(65 + j)}`;
            const optionIndex = opt.optionIndex || opt.id || String.fromCharCode(65 + j);
            
            return {
              text: optionText,
              isCorrect: !!opt.isCorrect,
              optionIndex
            };
          });
      } else {
        // 创建默认选项
        normalizedQuestion.options = [
          { text: '选项 A', isCorrect: true, optionIndex: 'A' },
          { text: '选项 B', isCorrect: false, optionIndex: 'B' }
        ];
      }
      
      return normalizedQuestion;
    });
}

/**
 * 用于快速测试和验证的函数
 */
function testNormalize() {
  const testCases = [
    { 
      input: null,
      expected: []
    },
    {
      input: [{text: null, options: [{text: "选项1"}]}],
      expected: [
        {
          text: "问题 0",
          explanation: "暂无解析",
          questionType: "single",
          orderIndex: 0,
          options: [{text: "选项1", isCorrect: false, optionIndex: "A"}]
        }
      ]
    },
    {
      input: [{question: "测试问题", options: null}],
      expected: [
        {
          text: "测试问题",
          explanation: "暂无解析",
          questionType: "single",
          orderIndex: 0,
          options: [
            {text: "选项 A", isCorrect: true, optionIndex: "A"},
            {text: "选项 B", isCorrect: false, optionIndex: "B"}
          ]
        }
      ]
    }
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const result = normalizeQuestionData(testCase.input);
    console.log('Test case', i+1);
    console.log('Input:', JSON.stringify(testCase.input));
    console.log('Output:', JSON.stringify(result));
    console.log('Expected:', JSON.stringify(testCase.expected));
    console.log('---------------------');
  }
}

// 执行测试
testNormalize();

/**
 * 如何在服务器上应用这个修复：
 * 
 * 1. 找到 /www/wwwroot/root/git/dist/server/dist/controllers/questionSetController.js 文件
 * 2. 将此文件开头的 normalizeQuestionData 函数复制到 questionSetController.js 中
 * 3. 在 updateQuestionSet 函数中，在处理 questions 前添加:
 *    if (Array.isArray(questions) && questions.length > 0) {
 *      questions = normalizeQuestionData(questions);
 *      console.log(`标准化了 ${questions.length} 个问题`);
 *    }
 * 
 * 这样可以确保所有问题的 text 字段都不会为 null
 */ 