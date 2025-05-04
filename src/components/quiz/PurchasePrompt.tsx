import React from 'react';
import { IQuestionSet } from '../../types/index';

interface PurchasePromptProps {
  questionSet: IQuestionSet;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  onShowPaymentModal: () => void;
  onShowRedeemCodeModal: () => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
  isLoggedIn: boolean;
  validityPeriod?: string;
  currencyCode?: string;
}

const PurchasePrompt: React.FC<PurchasePromptProps> = ({
  questionSet,
  totalQuestions,
  answeredCount,
  correctCount,
  onShowPaymentModal,
  onShowRedeemCodeModal,
  onNavigateHome,
  onNavigateProfile,
  isLoggedIn,
  validityPeriod = "6 months",
  currencyCode = "CNY"
}) => {
  const formatPrice = (price: number): string => {
    try {
      return new Intl.NumberFormat('zh-CN', { 
        style: 'currency', 
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(price);
    } catch (e) {
      const currencySymbol = currencyCode === "USD" ? "$" : 
                             currencyCode === "CNY" ? "¥" : 
                             currencyCode;
      return `${currencySymbol}${price.toFixed(2)}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">{questionSet.title}</h2>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg 
                className="h-5 w-5 text-yellow-400" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 20 20" 
                fill="currentColor"
                aria-hidden="true"
              >
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You have completed the free trial of {questionSet.trialQuestions ?? 'some'} questions.
                To access all {totalQuestions} questions, please purchase the full version or use a redemption code.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">Full Access</h3>
            <span className="text-xl font-bold text-green-600">{formatPrice(questionSet.price)}</span>
          </div>
          <p className="text-gray-600 mb-4">
            Purchase to access all {totalQuestions} questions, valid for {validityPeriod}.
            You've already completed {answeredCount} questions, with {correctCount} correct answers.
          </p>
          <div className="flex flex-col space-y-3">
            <button 
              onClick={onShowPaymentModal}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              aria-label={`Purchase full access to ${questionSet.title} for ${formatPrice(questionSet.price)}`}
            >
              Purchase Now
            </button>
            
            <button
              onClick={onShowRedeemCodeModal}
              className="w-full bg-green-50 text-green-700 border border-green-300 py-2 px-4 rounded hover:bg-green-100"
              aria-label="Use a redemption code to unlock full access"
            >
              Use Redemption Code
            </button>
          </div>
        </div>
        
        <div className="flex justify-between mt-4">
          <button
            onClick={onNavigateHome}
            className="bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
            aria-label="Return to the home page"
          >
            Return to Home
          </button>
          {isLoggedIn ? (
            <button
              onClick={onNavigateProfile}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              aria-label="View your purchased question sets"
            >
              View Purchased Sets
            </button>
          ) : (
            <button
              onClick={onNavigateProfile}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              aria-label="Log in or create an account"
            >
              Login/Register
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchasePrompt; 