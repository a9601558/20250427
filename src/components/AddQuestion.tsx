import React, { useState } from 'react';
import { Question, Option, QuestionType } from '../data/questions';

interface AddQuestionProps {
  onAddQuestion: (question: Question) => void;
  onCancel: () => void;
  questionCount: number;
}

const AddQuestion: React.FC<AddQuestionProps> = ({ onAddQuestion, onCancel, questionCount }) => {
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('single');
  const [options, setOptions] = useState<Option[]>([
    { id: 'A', text: '' },
    { id: 'B', text: '' },
    { id: 'C', text: '' },
    { id: 'D', text: '' },
  ]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 添加新选项
  const handleAddOption = () => {
    const nextOptionId = String.fromCharCode('A'.charCodeAt(0) + options.length);
    setOptions([...options, { id: nextOptionId, text: '' }]);
  };

  // 删除选项
  const handleRemoveOption = (optionId: string) => {
    // 至少保留两个选项
    if (options.length <= 2) {
      return;
    }
    
    setOptions(options.filter(option => option.id !== optionId));
    
    // 如果删除的是已选中的选项，重置选择
    if (selectedOption === optionId) {
      setSelectedOption('');
    }
    
    if (selectedOptions.includes(optionId)) {
      setSelectedOptions(selectedOptions.filter(id => id !== optionId));
    }
  };

  // 更新选项文本
  const handleOptionTextChange = (optionId: string, text: string) => {
    setOptions(
      options.map(option =>
        option.id === optionId ? { ...option, text } : option
      )
    );
  };

  // 切换多选选项
  const handleMultipleOptionToggle = (optionId: string) => {
    setSelectedOptions(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    );
  };

  // 提交题目
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证题目文本
    if (questionText.trim() === '') {
      setErrorMessage('请输入题目内容');
      return;
    }
    
    // 验证选项
    const validOptions = options.filter(option => option.text.trim() !== '');
    if (validOptions.length < 2) {
      setErrorMessage('请至少添加两个有效选项');
      return;
    }
    
    // 验证答案
    if (questionType === 'single' && !selectedOption) {
      setErrorMessage('请选择正确答案');
      return;
    }
    
    if (questionType === 'multiple' && selectedOptions.length === 0) {
      setErrorMessage('请至少选择一个正确答案');
      return;
    }
    
    // 验证解析
    if (explanation.trim() === '') {
      setErrorMessage('请输入解析');
      return;
    }
    
    // 创建题目对象
    const newQuestion: Question = {
      id: questionCount + 1,
      question: questionText,
      questionType,
      options: validOptions,
      correctAnswer: questionType === 'single' ? selectedOption : selectedOptions,
      explanation,
    };
    
    // 提交题目
    onAddQuestion(newQuestion);
  };

  return (
    <div className="bg-gray-50 p-6 rounded">
      <h3 className="text-lg font-medium text-gray-800 mb-4">添加题目</h3>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* 题目类型 */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">题目类型</label>
          <div className="flex space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={questionType === 'single'}
                onChange={() => setQuestionType('single')}
                className="form-radio"
              />
              <span className="ml-2">单选题</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                checked={questionType === 'multiple'}
                onChange={() => setQuestionType('multiple')}
                className="form-radio"
              />
              <span className="ml-2">多选题</span>
            </label>
          </div>
        </div>
        
        {/* 题目内容 */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">题目内容 *</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            placeholder="输入题目内容"
            required
          />
        </div>
        
        {/* 题目选项 */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-gray-700">选项 *</label>
            <button
              type="button"
              onClick={handleAddOption}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              + 添加选项
            </button>
          </div>
          
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.id} className="flex items-center">
                <div className="w-8 flex justify-center">
                  {questionType === 'single' ? (
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={selectedOption === option.id}
                      onChange={() => setSelectedOption(option.id)}
                      className="form-radio"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option.id)}
                      onChange={() => handleMultipleOptionToggle(option.id)}
                      className="form-checkbox"
                    />
                  )}
                </div>
                <div className="w-8 text-center font-medium">{option.id}.</div>
                <input
                  type="text"
                  value={option.text}
                  onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-3 py-2"
                  placeholder={`选项 ${option.id}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(option.id)}
                  className="ml-2 text-red-600 hover:text-red-800"
                  disabled={options.length <= 2}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {questionType === 'single' 
              ? '选择单个正确答案' 
              : '选择一个或多个正确答案'}
          </p>
        </div>
        
        {/* 解析 */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">解析 *</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            rows={3}
            placeholder="输入答案解析"
            required
          />
        </div>
        
        {/* 按钮组 */}
        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
          >
            取消
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            添加题目
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddQuestion; 