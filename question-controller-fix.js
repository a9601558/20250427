/**
 * 题目控制器修复 - 直接替换代码
 * 使用方法:
 * 1. 复制下面的函数到服务器上的 /www/wwwroot/root/git/dist/server/dist/controllers/questionSetController.js 文件中
 * 2. 找到 exports.updateQuestionSet = updateQuestionSet; 行之前的位置
 * 3. 粘贴这段代码，替换原来的 normalizeQuestionData 函数和 updateQuestionSet 函数
 */

/**
 * 规范化问题数据，确保数据格式一致
 * @param {Array|Object} questionData - 问题数据，可能是数组或单个对象
 * @returns {Array} - 规范化后的问题数组
 */
const normalizeQuestionData = (questionData) => {
  // 确保 questionData 是数组形式
  const questionsArray = Array.isArray(questionData) ? questionData : [questionData];
  
  // 过滤掉 null 或 undefined 的问题
  return questionsArray.filter(q => q != null).map(question => {
    // 确保文本字段不为空，设置默认值
    if (!question.text || question.text.trim() === '') {
      console.log('[normalizeQuestionData] 发现空文本问题，设置默认值');
      question.text = '默认问题文本';
    }
    
    // 规范化选项数据
    if (question.options) {
      question.options = Array.isArray(question.options) 
        ? question.options.filter(opt => opt != null).map(option => {
            // 确保选项文本不为空
            if (!option.text || option.text.trim() === '') {
              option.text = '默认选项文本';
            }
            return option;
          })
        : [];
    } else {
      question.options = [];
    }
    
    return question;
  });
};

/**
 * 更新问题集
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 */
const updateQuestionSet = async (req, res) => {
  const transaction = await models.sequelize.transaction();
  
  try {
    console.log(`[updateQuestionSet] 收到更新请求, ID: ${req.params.id}`);
    console.log(`[updateQuestionSet] 请求体: ${JSON.stringify(req.body)}`);
    
    const questionSetId = req.params.id;
    const { name, description, questions } = req.body;
    
    // 查找问题集
    const questionSet = await models.QuestionSet.findByPk(questionSetId, { transaction });
    
    if (!questionSet) {
      await transaction.rollback();
      console.log(`[updateQuestionSet] 问题集未找到, ID: ${questionSetId}`);
      return res.status(404).json({ error: "问题集未找到" });
    }
    
    // 规范化问题数据
    const normalizedQuestions = normalizeQuestionData(questions);
    console.log(`[updateQuestionSet] 规范化后问题数量: ${normalizedQuestions.length}`);
    
    // 更新问题集基本信息
    await questionSet.update({
      name: name || questionSet.name,
      description: description !== undefined ? description : questionSet.description
    }, { transaction });
    
    // 查找所有现有问题
    const existingQuestions = await models.Question.findAll({
      where: { questionSetId },
      include: [{ model: models.Option }],
      transaction
    });
    
    // 创建问题ID映射
    const existingQuestionsMap = existingQuestions.reduce((acc, q) => {
      acc[q.id] = q;
      return acc;
    }, {});
    
    // 更新问题和选项
    for (const [index, questionData] of normalizedQuestions.entries()) {
      console.log(`[updateQuestionSet] 处理问题 ${index+1}/${normalizedQuestions.length}`);
      
      let question;
      
      // 如果问题已存在，更新它
      if (questionData.id && existingQuestionsMap[questionData.id]) {
        question = existingQuestionsMap[questionData.id];
        
        // 确保问题文本不为null
        const questionText = questionData.text || question.text || '默认问题文本';
        
        console.log(`[updateQuestionSet] 更新现有问题, ID: ${question.id}, 文本: ${questionText.substring(0, 30)}...`);
        
        await question.update({
          text: questionText,
          order: questionData.order !== undefined ? questionData.order : index,
          type: questionData.type || question.type
        }, { transaction });
        
        // 从映射中删除，用于跟踪要删除的问题
        delete existingQuestionsMap[question.id];
      } 
      // 否则创建新问题
      else {
        // 确保问题文本不为null
        const questionText = questionData.text || '默认问题文本';
        
        console.log(`[updateQuestionSet] 创建新问题, 文本: ${questionText.substring(0, 30)}...`);
        
        question = await models.Question.create({
          text: questionText,
          questionSetId,
          order: questionData.order !== undefined ? questionData.order : index,
          type: questionData.type || 'single'
        }, { transaction });
      }
      
      // 获取现有选项
      const existingOptions = question.Options || [];
      const existingOptionsMap = existingOptions.reduce((acc, o) => {
        acc[o.id] = o;
        return acc;
      }, {});
      
      // 处理问题的选项
      if (Array.isArray(questionData.options)) {
        for (const [optIndex, optionData] of questionData.options.entries()) {
          // 跳过null选项
          if (optionData == null) {
            console.log(`[updateQuestionSet] 跳过null选项`);
            continue;
          }
          
          // 确保选项文本不为null
          const optionText = optionData.text || '默认选项文本';
          
          // 如果选项已存在，更新它
          if (optionData.id && existingOptionsMap[optionData.id]) {
            const option = existingOptionsMap[optionData.id];
            console.log(`[updateQuestionSet] 更新选项, ID: ${option.id}`);
            
            await option.update({
              text: optionText,
              isCorrect: optionData.isCorrect !== undefined ? optionData.isCorrect : option.isCorrect,
              order: optionData.order !== undefined ? optionData.order : optIndex
            }, { transaction });
            
            // 从映射中删除
            delete existingOptionsMap[option.id];
          } 
          // 否则创建新选项
          else {
            console.log(`[updateQuestionSet] 创建新选项: ${optionText.substring(0, 20)}...`);
            
            await models.Option.create({
              text: optionText,
              questionId: question.id,
              isCorrect: optionData.isCorrect !== undefined ? optionData.isCorrect : false,
              order: optionData.order !== undefined ? optionData.order : optIndex
            }, { transaction });
          }
        }
      }
      
      // 删除不再需要的选项
      for (const optionId in existingOptionsMap) {
        console.log(`[updateQuestionSet] 删除选项, ID: ${optionId}`);
        await existingOptionsMap[optionId].destroy({ transaction });
      }
    }
    
    // 删除不再需要的问题
    for (const questionId in existingQuestionsMap) {
      console.log(`[updateQuestionSet] 删除问题, ID: ${questionId}`);
      await existingQuestionsMap[questionId].destroy({ transaction });
    }
    
    await transaction.commit();
    console.log(`[updateQuestionSet] 更新成功, ID: ${questionSetId}`);
    
    return res.status(200).json({
      message: "问题集已更新",
      id: questionSet.id
    });
  } catch (error) {
    await transaction.rollback();
    console.error('[updateQuestionSet] 错误:', error);
    
    // 详细的错误信息
    if (error.name === 'SequelizeValidationError') {
      const validationErrors = error.errors.map(e => ({
        field: e.path,
        message: e.message
      }));
      console.error('[updateQuestionSet] 验证错误:', JSON.stringify(validationErrors));
      return res.status(400).json({ 
        error: "验证错误", 
        details: validationErrors 
      });
    }
    
    return res.status(500).json({ error: "更新问题集时出错", details: error.message });
  }
}; 