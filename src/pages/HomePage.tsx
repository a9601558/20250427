import React, { useContext, useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, CardActions, Button, CircularProgress } from '@mui/material';
import { Link } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext';
import { QuestionSet } from '../types';
import questionApi from '../api/questionApi';
import { useSocket } from '../contexts/SocketContext';

const HomePage: React.FC = () => {
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, syncAccessRights } = useContext(UserContext);
  const socket = useSocket();
  
  // 加载所有题库
  useEffect(() => {
    const fetchQuestionSets = async () => {
      try {
        setLoading(true);
        const response = await questionApi.getAllQuestionSets();
        if (response.success && response.data) {
          setQuestionSets(response.data);
        } else {
          setError(response.message || 'Failed to load question sets');
        }
      } catch (error) {
        console.error('Error loading question sets:', error);
        setError('An error occurred while loading the question sets');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionSets();
  }, []);
  
  // 用户登录后立即同步
  useEffect(() => {
    if (user?.id) {
      console.log('[HomePage] 用户已登录，同步访问权限');
      syncAccessRights();
    }
  }, [user?.id, syncAccessRights]);
  
  // 监听访问权限更新事件
  useEffect(() => {
    const handleAccessUpdate = (event: CustomEvent) => {
      console.log('[HomePage] 接收到访问权限更新事件:', event.detail);
    };
    
    window.addEventListener('accessRights:updated', handleAccessUpdate as EventListener);
    
    return () => {
      window.removeEventListener('accessRights:updated', handleAccessUpdate as EventListener);
    };
  }, []);
  
  // 监听设备同步事件
  useEffect(() => {
    if (!socket || !user?.id) return;
    
    const handleDeviceSync = (data: {userId: string, type: string}) => {
      if (data.userId !== user.id) return;
      
      console.log(`[HomePage] 收到设备同步事件: ${data.type}`);
      
      if (data.type === 'access_refresh') {
        // 收到设备同步通知后重新同步数据
        syncAccessRights();
      }
    };
    
    socket.on('user:deviceSync', handleDeviceSync);
    
    return () => {
      socket.off('user:deviceSync', handleDeviceSync);
    };
  }, [socket, user?.id, syncAccessRights]);
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        可用题库
      </Typography>
      
      <Grid container spacing={3}>
        {questionSets.map((set) => (
          <Grid item xs={12} sm={6} md={4} key={set.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" component="h2" gutterBottom>
                  {set.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  题目数量: {set.questions?.length || 0}
                </Typography>
                {set.description && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {set.description}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  component={Link}
                  to={`/quiz/${set.id}`}
                  variant="contained"
                  color="primary"
                  size="small"
                >
                  进入题库
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default HomePage; 