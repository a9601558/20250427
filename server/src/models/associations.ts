import QuestionSet from './QuestionSet';
import Question from './Question';
import Option from './Option';

// 设置问题集和问题之间的关联
QuestionSet.hasMany(Question, {
  foreignKey: 'questionSetId',
  as: 'questions'
});

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