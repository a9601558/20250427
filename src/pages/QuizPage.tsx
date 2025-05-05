import React, { useEffect, useState, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Box, CircularProgress, Alert } from '@mui/material';
import QuestionCard from '../components/QuestionCard';
import { QuestionSet, Question } from '../types';
import { UserContext } from '../contexts/UserContext';
import questionApi from '../api/questionApi';
import { useSocket } from '../contexts/SocketContext';

const QuizPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  const [accessRights, setAccessRights] = useState<{hasAccess: boolean, remainingDays?: number | null}>({
    hasAccess: false,
    remainingDays: null
  });
  
  const { user, hasAccessToQuestionSet, syncAccessRights } = useContext(UserContext);
  const socket = useSocket();
  
  // 进入页面后检查数据库中的购买记录
  useEffect(() => {
    const checkDatabaseAccess = async () => {
      if (!id || !user?.id) return;
      
      try {
        console.log(`[QuizPage] 检查题库数据库权限: ${id}`);
        
        // 进入页面后立即同步访问权限
        await syncAccessRights();
        
        // 然后检查本地访问权限
        const hasAccess = await hasAccessToQuestionSet(id);
        
        console.log(`[QuizPage] 访问权限检查结果: ${hasAccess}`);
        
        setAccessRights(prev => ({
          ...prev,
          hasAccess
        }));
        
        setAccessCheckComplete(true);
      } catch (error) {
        console.error('[QuizPage] 权限检查错误:', error);
        setAccessCheckComplete(true);
      }
    };
    
    checkDatabaseAccess();
  }, [id, user?.id, hasAccessToQuestionSet, syncAccessRights]);
  
  // 监听访问权限更新事件
  useEffect(() => {
    const handleAccessUpdate = (event: CustomEvent) => {
      if (!id) return;
      
      console.log(`[QuizPage] 接收到访问权限更新事件: `, event.detail);
      
      // 重新检查本地权限
      const checkAccessAfterUpdate = async () => {
        try {
          const hasAccess = await hasAccessToQuestionSet(id);
          console.log(`[QuizPage] 更新后的访问权限: ${hasAccess}`);
          
          setAccessRights(prev => ({
            ...prev,
            hasAccess
          }));
        } catch (error) {
          console.error('[QuizPage] 更新后权限检查错误:', error);
        }
      };
      
      checkAccessAfterUpdate();
    };
    
    window.addEventListener('accessRights:updated', handleAccessUpdate as EventListener);
    
    return () => {
      window.removeEventListener('accessRights:updated', handleAccessUpdate as EventListener);
    };
  }, [id, hasAccessToQuestionSet]);
  
  // 监听设备同步事件
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    const handleDeviceSync = (data: {userId: string, type: string}) => {
      if (data.userId !== user.id) return;
      
      console.log(`[QuizPage] 收到设备同步事件: ${data.type}`);
      
      if (data.type === 'access_refresh' && id) {
        // 收到设备同步通知后重新同步数据
        syncAccessRights().then(() => {
          // 同步完成后重新检查访问权限
          hasAccessToQuestionSet(id).then(hasAccess => {
            console.log(`[QuizPage] 设备同步后权限: ${hasAccess}`);
            setAccessRights(prev => ({
              ...prev,
              hasAccess
            }));
          });
        });
      }
    };
    
    socket.on('user:deviceSync', handleDeviceSync);
    
    // 监听题库访问权限更新
    socket.on('questionSet:accessUpdate', (data: {
      userId: string;
      questionSetId: string;
      hasAccess: boolean;
      remainingDays?: number | null;
    }) => {
      if (data.userId !== user.id || data.questionSetId !== id) return;
      
      console.log(`[QuizPage] 收到题库访问权限更新: ${data.hasAccess}, 剩余天数: ${data.remainingDays}`);
      
      setAccessRights({
        hasAccess: data.hasAccess,
        remainingDays: data.remainingDays
      });
    });
    
    return () => {
      socket.off('user:deviceSync', handleDeviceSync);
      socket.off('questionSet:accessUpdate');
    };
  }, [socket, user?.id, id, hasAccessToQuestionSet, syncAccessRights]);
  
  // 加载题库数据
  useEffect(() => {
    if (!id) {
      setError('Question set ID is missing');
      setLoading(false);
      return;
    }
    
    const fetchQuestionSet = async () => {
      try {
        setLoading(true);
        const response = await questionApi.getQuestionSet(id);
        if (response.success && response.data) {
          setQuestionSet(response.data);
        } else {
          setError(response.message || 'Failed to load question set');
        }
      } catch (error) {
        console.error('Error loading question set:', error);
        setError('An error occurred while loading the question set');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionSet();
  }, [id]);
  
  // 处理问题导航
  const handleNext = useCallback(() => {
    if (questionSet && currentQuestionIndex < questionSet.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  }, [questionSet, currentQuestionIndex]);
  
  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  }, [currentQuestionIndex]);
  
  // 渲染内容
  if (loading || !accessCheckComplete) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }
  
  if (!questionSet) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">题库未找到</Alert>
      </Box>
    );
  }
  
  if (!accessRights.hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          您没有访问该题库的权限。请购买或激活此题库。
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">
            题库名称: {questionSet.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            题目数量: {questionSet.questions.length}
          </Typography>
        </Box>
      </Box>
    );
  }
  
  const currentQuestion = questionSet.questions[currentQuestionIndex];
  
  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        {questionSet.title}
      </Typography>
      
      {accessRights.remainingDays !== null && (
        <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
          剩余访问时间: {accessRights.remainingDays} 天
        </Typography>
      )}
      
      <Typography variant="subtitle1" sx={{ mb: 3 }}>
        问题 {currentQuestionIndex + 1} / {questionSet.questions.length}
      </Typography>
      
      {currentQuestion && (
        <QuestionCard
          question={currentQuestion}
          questionSetId={id!}
          onNext={handleNext}
          onPrevious={handlePrevious}
          isLast={currentQuestionIndex === questionSet.questions.length - 1}
          isFirst={currentQuestionIndex === 0}
          questionIndex={currentQuestionIndex}
        />
      )}
    </Box>
  );
};

export default QuizPage; 