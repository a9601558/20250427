import React from 'react';
import { useSocket } from '../contexts/SocketContext';

const SocketStatus: React.FC = () => {
  const { connected, reconnect } = useSocket();

  if (connected) {
    return (
      <div className="fixed bottom-4 right-4 flex items-center px-3 py-1 bg-green-500 text-white rounded-md text-sm shadow-md">
        <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
        Socket 已连接
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-start p-3 bg-red-100 border border-red-300 rounded-md shadow-lg">
      <div className="flex items-center">
        <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
        <span className="text-red-700 text-sm font-medium">Socket 连接失败</span>
      </div>
      
      <button
        onClick={reconnect}
        className="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        重新连接
      </button>
    </div>
  );
};

export default SocketStatus; 