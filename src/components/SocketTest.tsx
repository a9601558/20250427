import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const SocketTest: React.FC = () => {
  const { socket, isConnected, connectionError, reconnect } = useSocket();
  const [messageText, setMessageText] = useState('');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [eventName, setEventName] = useState('message');

  // 监听服务器消息
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (message: string) => {
      setReceivedMessages(prev => [...prev, `收到消息: ${message}`]);
    };

    socket.on(eventName, handleMessage);

    return () => {
      socket.off(eventName, handleMessage);
    };
  }, [socket, eventName]);

  // 发送消息
  const sendMessage = () => {
    if (!socket || !isConnected || !messageText.trim()) return;

    try {
      socket.emit(eventName, messageText);
      setReceivedMessages(prev => [...prev, `发送消息: ${messageText}`]);
      setMessageText('');
    } catch (error) {
      console.error('发送消息失败:', error);
      setReceivedMessages(prev => [...prev, `发送失败: ${error}`]);
    }
  };

  return (
    <div className="p-4 bg-white shadow rounded-lg">
      <h2 className="text-xl font-bold mb-4">Socket.IO 连接测试</h2>

      {/* 连接状态 */}
      <div className={`p-3 mb-4 rounded-md ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="font-medium">
            {isConnected ? 'Socket 已连接' : 'Socket 未连接'}
          </span>
        </div>
        {connectionError && (
          <div className="mt-1 text-sm">
            错误: {connectionError}
          </div>
        )}
        {!isConnected && (
          <button
            onClick={reconnect}
            className="mt-2 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md"
          >
            重新连接
          </button>
        )}
      </div>

      {/* 消息发送 */}
      <div className="mb-4">
        <div className="flex mb-2">
          <input
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="事件名称"
            className="border rounded-md px-3 py-2 mr-2 w-1/3"
          />
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="输入消息"
            className="border rounded-md px-3 py-2 flex-grow"
            disabled={!isConnected}
          />
          <button
            onClick={sendMessage}
            className={`ml-2 px-4 py-2 rounded-md ${
              isConnected
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!isConnected}
          >
            发送
          </button>
        </div>
        <p className="text-xs text-gray-500">
          使用"message"作为事件名称测试基本通信，或与后端开发人员确认其他可用的事件名称
        </p>
      </div>

      {/* 消息记录 */}
      <div className="border rounded-md p-3 bg-gray-50 h-60 overflow-y-auto">
        <h3 className="font-medium mb-2">消息记录:</h3>
        {receivedMessages.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无消息</p>
        ) : (
          <ul className="space-y-1">
            {receivedMessages.map((msg, index) => (
              <li key={index} className="text-sm">
                {msg}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 调试信息 */}
      <div className="mt-4 text-xs text-gray-600">
        <p>Socket ID: {socket?.id || 'N/A'}</p>
        <p>
          连接URL: ws://localhost:10000/Servers
        </p>
      </div>
    </div>
  );
};

export default SocketTest; 