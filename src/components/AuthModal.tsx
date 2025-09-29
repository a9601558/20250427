import React from 'react';
import OIDCAuth from './OIDCAuth';

interface AuthModalProps {
  isOpen?: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen = true, 
  onClose
}) => {
  if (!isOpen) return null;

  // 统一使用OIDC认证
  return <OIDCAuth isOpen={isOpen} onClose={onClose} />;
};

export default AuthModal;