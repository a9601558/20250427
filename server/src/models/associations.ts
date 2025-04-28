import Question from './Question';
import Option from './Option';

export const setupAssociations = () => {
  // Question 和 Option 的关联
  Question.hasMany(Option, {
    foreignKey: 'questionId',
    as: 'options'
  });

  Option.belongsTo(Question, {
    foreignKey: 'questionId',
    as: 'question'
  });
}; 