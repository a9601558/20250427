import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
  // Size mapping
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }[size];

  return (
    <div className="flex items-center justify-center">
      <div className={`animate-spin ${sizeClass} border-4 border-blue-200 rounded-full border-t-blue-600`}></div>
    </div>
  );
};

export default LoadingSpinner; 