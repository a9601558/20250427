import React, { useState, useEffect } from 'react';
import { Question, QuestionOption, QuestionType } from '../data/questions';

interface Option {
  id: string;
  text: string;
  optionIndex: string;
}

interface EditQuestionProps {
  question: Question;
  onSave: (question: Question) => void;
  onCancel: () => void;
}

const EditQuestion: React.FC<EditQuestionProps> = ({ question, onSave, onCancel }) => {
  const [questionText, setQuestionText] = useState(question.text);
  const [explanation, setExplanation] = useState(question.explanation || '');
  const [questionType, setQuestionType] = useState<QuestionType>(question.questionType);
  const [options, setOptions] = useState<Option[]>([]);
  const [selectedOption, setSelectedOption] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // 初始化数据
  useEffect(() => {
    if (question && question.options) {
      // 转换选项格式
      const initialOptions = question.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        optionIndex: opt.optionIndex || opt.id
      }));
      
      setOptions(initialOptions);
      
      // 设置正确答案
      if (question.questionType === 'single') {
        const correctOption = question.options.find(opt => opt.isCorrect);
        if (correctOption) {
          setSelectedOption(correctOption.id);
        }
      } else {
        const correctOptions = question.options
          .filter(opt => opt.isCorrect)
          .map(opt => opt.id);
        setSelectedOptions(correctOptions);
      }
    }
  }, [question]);

  // 添加新选项
  const handleAddOption = () => {
    const nextOptionId = String.fromCharCode('A'.charCodeAt(0) + options.length);
    setOptions([...options, { id: nextOptionId, text: '', optionIndex: nextOptionId }]);
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

  // 提交表单
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证表单
    if (!questionText.trim()) {
      setErrorMessage('请输入题目内容');
      return;
    }
    
    if (options.some(option => !option.text.trim())) {
      setErrorMessage('选项内容不能为空');
      return;
    }
    
    if (questionType === 'single' && !selectedOption) {
      setErrorMessage('请选择一个正确答案');
      return;
    }
    
    if (questionType === 'multiple' && selectedOptions.length === 0) {
      setErrorMessage('请至少选择一个正确答案');
      return;
    }
    
    // 创建问题对象
    const questionOptions: QuestionOption[] = options.map(option => ({
      id: option.id,
      text: option.text,
      isCorrect:
        questionType === 'single'
          ? option.id === selectedOption
          : selectedOptions.includes(option.id)
    }));
    
    const updatedQuestion: Question = {
      ...question,
      text: questionText,
      explanation: explanation || '暂无解析',
      questionType,
      options: questionOptions,
    };
    
    onSave(updatedQuestion);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p>{errorMessage}</p>
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          题目内容
        </label>
        <textarea
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="题目内容"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          解析
        </label>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="题目解析（可选）"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          题目类型
        </label>
        <select
          value={questionType}
          onChange={(e) => {
            setQuestionType(e.target.value as QuestionType);
            setSelectedOption('');
            setSelectedOptions([]);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="single">单选题</option>
          <option value="multiple">多选题</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          选项
        </label>
        <div className="space-y-2">
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-2">
              {questionType === 'single' ? (
                <input
                  type="radio"
                  name="correctOption"
                  checked={selectedOption === option.id}
                  onChange={() => setSelectedOption(option.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
              ) : (
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(option.id)}
                  onChange={() => handleMultipleOptionToggle(option.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
              )}
              <div className="w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-800 rounded-full">
                {option.optionIndex}
              </div>
              <input
                type="text"
                value={option.text}
                onChange={(e) => handleOptionTextChange(option.id, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`选项 ${option.optionIndex}`}
                required
              />
              <button
                type="button"
                onClick={() => handleRemoveOption(option.id)}
                disabled={options.length <= 2}
                className={`p-2 rounded-md ${
                  options.length <= 2
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-red-600 hover:bg-red-50'
                }`}
              >
                删除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddOption}
          className="mt-2 inline-flex items-center px-3 py-2 border border-blue-300 text-sm font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100"
        >
          添加选项
        </button>
      </div>
      
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          保存修改
        </button>
      </div>
    </form>
  );
};

export default EditQuestion; 