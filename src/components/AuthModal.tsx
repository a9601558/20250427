import React from 'react';
import CognitoAuth from './CognitoAuth';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen = true, 
  onClose
}) => {
  if (!isOpen) return null;

  // Amplify直接統合を使用（Hosted UI不要）
  return <CognitoAuth isOpen={isOpen} onClose={onClose} />;
};

export default AuthModal;