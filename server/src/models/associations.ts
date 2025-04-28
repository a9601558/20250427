import Question from './Question';
import Option from './Option';
import QuestionSet from './QuestionSet';

export const setupAssociations = () => {
  // QuestionSet 和 Question 的关联
  QuestionSet.hasMany(Question, {
    foreignKey: 'questionSetId',
    as: 'questions',
    onDelete: 'CASCADE'
  });

  Question.belongsTo(QuestionSet, {
    foreignKey: 'questionSetId',
    as: 'questionSet'
  });

  // Question 和 Option 的关联
  Question.hasMany(Option, {
    foreignKey: 'questionId',
    as: 'options',
    onDelete: 'CASCADE'
  });

  Option.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });
}; 