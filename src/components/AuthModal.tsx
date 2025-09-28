import React from 'react';
import CognitoAuth from './CognitoAuth';
import LoginModal from './LoginModal';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
  useCognito?: boolean; // 控制使用哪种认证方式
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen = true, 
  onClose, 
  useCognito = true // 默认使用Cognito认证
}) => {
  if (!isOpen) return null;

  if (useCognito) {
    return <CognitoAuth isOpen={isOpen} onClose={onClose} />;
  } else {
    return <LoginModal isOpen={isOpen} onClose={onClose} />;
  }
};

export default AuthModal;