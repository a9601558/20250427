import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import HomePage from './components/HomePage';
import QuizPage from './components/QuizPage';
import ProfilePage from './components/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import { UserProvider } from './contexts/UserContext';
import AdminPage from './components/AdminPage';
import { SocketProvider } from './contexts/SocketContext';
import { ToastContainer } from 'react-toastify';
import { UserProgressProvider } from './contexts/UserProgressContext';

const App: React.FC = () => {
  return (
    <UserProgressProvider>
      <SocketProvider>
        <UserProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                } />
                <Route path="/quiz/:questionSetId" element={<QuizPage />} />
              </Routes>
            </Layout>
          </Router>
          <ToastContainer 
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </UserProvider>
      </SocketProvider>
    </UserProgressProvider>
  );
};

export default App;
