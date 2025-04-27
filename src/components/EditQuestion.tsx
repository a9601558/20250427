import React, { useState } from 'react';
import { Question } from '../data/questions';

interface EditQuestionProps {
  question: Question;
  onSave: (question: Question) => void;
  onCancel: () => void;
}

const EditQuestion: React.FC<EditQuestionProps> = ({ question, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    text: question.text,
    explanation: question.explanation || '',
    questionType: question.questionType || 'single',
    options: question.options.map(opt => ({
      text: opt.text,
      isCorrect: opt.isCorrect
    }))
  });

  const handleOptionChange = (index: number, field: 'text' | 'isCorrect', value: string | boolean) => {
    const newOptions = [...formData.options];
    newOptions[index] = {
      ...newOptions[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [
        ...prev.options,
        { text: '', isCorrect: false }
      ]
    }));
  };

  const handleRemoveOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证表单
    if (!formData.text.trim()) {
      alert('请输入题目内容');
      return;
    }
    
    if (formData.options.length < 2) {
      alert('至少需要两个选项');
      return;
    }
    
    if (!formData.options.some(opt => opt.isCorrect)) {
      alert('至少需要一个正确答案');
      return;
    }
    
    if (formData.questionType === 'single' && formData.options.filter(opt => opt.isCorrect).length > 1) {
      alert('单选题只能有一个正确答案');
      return;
    }
    
    // 创建更新后的题目对象
    const updatedQuestion: Question = {
      ...question,
      text: formData.text,
      explanation: formData.explanation,
      questionType: formData.questionType,
      options: formData.options.map((opt, index) => ({
        id: `opt_${index}`,
        text: opt.text,
        isCorrect: opt.isCorrect
      }))
    };
    
    onSave(updatedQuestion);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          题目内容
        </label>
        <textarea
          value={formData.text}
          onChange={(e) => setFormData(prev => ({ ...prev, text: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          题目解析
        </label>
        <textarea
          value={formData.explanation}
          onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          题目类型
        </label>
        <select
          value={formData.questionType}
          onChange={(e) => setFormData(prev => ({ ...prev, questionType: e.target.value as 'single' | 'multiple' }))}
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
          {formData.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={option.isCorrect}
                onChange={(e) => handleOptionChange(index, 'isCorrect', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <input
                type="text"
                value={option.text}
                onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`选项 ${index + 1}`}
                required
              />
              <button
                type="button"
                onClick={() => handleRemoveOption(index)}
                className="text-red-600 hover:text-red-800"
              >
                删除
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddOption}
          className="mt-2 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          添加选项
        </button>
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          取消
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          保存
        </button>
      </div>
    </form>
  );
};

export default EditQuestion; 