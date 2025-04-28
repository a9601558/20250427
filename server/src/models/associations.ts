import QuestionSet from './QuestionSet';
import Question from './Question';
import Option from './Option';

// 注意：QuestionSet.hasMany(Question) 已经在 QuestionSet.ts 中定义
// 我们只需添加还没有定义的关联

// 设置问题和题库之间的关联（题库->问题已在QuestionSet.ts中定义）
Question.belongsTo(QuestionSet, {
  foreignKey: 'questionSetId',
  as: 'questionSet'
});

// 设置问题和选项之间的关联
Question.hasMany(Option, {
  foreignKey: 'questionId',
  as: 'options'
});

Option.belongsTo(Question, {
  foreignKey: 'questionId',
  as: 'question'
});

export { QuestionSet, Question, Option }; 