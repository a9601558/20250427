import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Layout from './components/Layout';
import HomePage from './components/HomePage';
import QuizPage from './components/QuizPage';
import ProfilePage from './components/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { UserProvider } from './contexts/UserContext';
import AdminPage from './components/AdminPage';
import RedeemCodeAdmin from './components/RedeemCodeAdmin';
import { SocketProvider } from './contexts/SocketContext';
import { ToastContainer } from 'react-toastify';
import { UserProgressProvider } from './contexts/UserProgressContext';
import TestPayment from './pages/TestPayment';

const App: React.FC = () => {
  return (
    <UserProvider>
      <SocketProvider>
        <UserProgressProvider>
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
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                } />
                <Route path="/admin/redeem-codes" element={
                  <AdminRoute>
                    <RedeemCodeAdmin />
                  </AdminRoute>
                } />
                <Route path="/quiz/:questionSetId" element={<QuizPage />} />
                <Route path="/payment/:id" element={<Navigate to="/" replace />} />
                <Route path="/test-payment" element={<TestPayment />} />
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
        </UserProgressProvider>
      </SocketProvider>
    </UserProvider>
  );
};

export default App;
