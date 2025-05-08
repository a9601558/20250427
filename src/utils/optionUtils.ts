/**
 * 选项相关工具函数库
 */

/**
 * 获取选项标签（A, B, C, D...）
 * @param index 选项索引
 * @returns 选项字母标签
 */
export const getOptionLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // 65 是 'A' 的 ASCII 码
};

/**
 * 格式化选项数据，添加标签
 * @param options 原始选项数组
 * @returns 格式化后的选项数组
 */
export const formatOptions = (options: any[]) => {
  if (!options || !Array.isArray(options)) return [];
  
  return options.map((opt, index) => ({
    ...opt,
    label: opt.label || getOptionLabel(index)
  }));
};

/**
 * 确定选项的样式类
 * @param isSelected 是否被选中
 * @param isSubmitted 是否已提交
 * @param isCorrect 正确选项ID
 * @param optionId 当前选项ID
 * @returns 样式类名
 */
export const getOptionStyleClass = (
  isSelected: boolean, 
  isSubmitted: boolean, 
  isCorrect: string | null, 
  optionId: string
): string => {
  if (!isSubmitted) {
    return isSelected ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50';
  }
  
  if (isSelected) {
    return isCorrect === optionId
      ? 'bg-green-100 border-green-500' 
      : 'bg-red-100 border-red-500';
  }
  
  if (optionId === isCorrect) {
    return 'bg-green-100 border-green-500';
  }
  
  return 'bg-white';
}; 