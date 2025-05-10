import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between">
          <div className="mb-4 md:mb-0">
            <h2 className="text-lg font-bold mb-2">Exam7</h2>
            <p className="text-gray-400 text-sm">
              提供高质量的模拟练习题和测试，助您备考各类考试
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <h3 className="font-medium mb-2">关于我们</h3>
              <ul className="text-sm text-gray-400">
                <li className="mb-1"><Link to="/about" className="hover:text-blue-300">公司简介</Link></li>
                <li className="mb-1"><Link to="/contact" className="hover:text-blue-300">联系我们</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">服务</h3>
              <ul className="text-sm text-gray-400">
                <li className="mb-1"><Link to="/" className="hover:text-blue-300">题库列表</Link></li>
                <li className="mb-1"><Link to="/profile" className="hover:text-blue-300">个人中心</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">资源</h3>
              <ul className="text-sm text-gray-400">
                <li className="mb-1"><Link to="/faq" className="hover:text-blue-300">常见问题</Link></li>
                <li className="mb-1"><Link to="/terms" className="hover:text-blue-300">服务条款</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        <hr className="border-gray-700 my-4" />
        
        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-400 mb-2 md:mb-0">
            &copy; {new Date().getFullYear()} Exam7. 版权所有
          </p>
          <div className="flex space-x-4">
            <a href="#" className="text-gray-400 hover:text-blue-300">
              <span className="sr-only">Facebook</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-blue-300">
              <span className="sr-only">GitHub</span>
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 