import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { Progress, Card, Typography, Row, Col, Statistic, Spin, message } from 'antd';
import { useSocket } from '../contexts/SocketContext';
import { userProgressService } from '../services/api';

const { Title, Text } = Typography;

interface ProgressStats {
  overall: {
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    averageTimeSpent: number;
  };
  bySet: Record<string, {
    title?: string;
    total: number;
    correct: number;
    timeSpent: number;
    accuracy?: number;
    averageTime?: number;
  }>;
  byType: Record<string, {
    total: number;
    correct: number;
    timeSpent: number;
    accuracy?: number;
    averageTime?: number;
  }>;
}

interface UserProgressData {
  totalQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
  title?: string;
}

const UserProgressComponent: React.FC = () => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const response = await userProgressService.getUserStats();
        if (response.success && response.data) {
          setStats(response.data);
          setError(null);
        } else {
          setError(response.message || '获取进度数据失败');
        }
      } catch (err) {
        setError('获取进度数据时发生错误');
        console.error('Error fetching progress:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    // 设置socket监听
    if (socket) {
      const handleProgressUpdate = (data: any) => {
        message.success('学习进度已更新');
        fetchProgress(); // 重新获取最新数据
      };

      socket.on('progress_updated', handleProgressUpdate);

      socket.on('disconnect', (reason) => {
        console.log(`Socket.IO 连接断开: ID=${socket.id}, 原因=${reason}`);
      });

      return () => {
        socket.off('progress_updated', handleProgressUpdate);
      };
    }
  }, [user, socket]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <Text>正在加载学习进度...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text type="danger">{error}</Text>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Text>暂无学习进度数据</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>学习进度概览</Title>
      
      {/* 总体统计 */}
      <Card style={{ marginBottom: '24px' }}>
        <Title level={4}>总体统计</Title>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="总答题数" value={stats.overall.totalQuestions} />
          </Col>
          <Col span={6}>
            <Statistic title="正确答题数" value={stats.overall.correctAnswers} />
          </Col>
          <Col span={6}>
            <Statistic title="正确率" value={stats.overall.accuracy} suffix="%" precision={1} />
          </Col>
          <Col span={6}>
            <Statistic title="平均用时" value={stats.overall.averageTimeSpent} suffix="秒" precision={1} />
          </Col>
        </Row>
      </Card>

      {/* 按题库统计 */}
      <Card style={{ marginBottom: '24px' }}>
        <Title level={4}>按题库统计</Title>
        <Row gutter={[16, 16]}>
          {Object.entries(stats.bySet).map(([setId, setStats]) => (
            <Col span={8} key={setId}>
              <Card size="small" title={setStats.title || `题库 ${setId}`}>
                <Progress
                  type="circle"
                  percent={setStats.accuracy || 0}
                  format={(percent?: number) => `${percent || 0}%`}
                />
                <div style={{ marginTop: '16px' }}>
                  <Text>总题数: {setStats.total}</Text>
                  <br />
                  <Text>正确数: {setStats.correct}</Text>
                  <br />
                  <Text>平均用时: {setStats.averageTime?.toFixed(1)}秒</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 按题型统计 */}
      <Card>
        <Title level={4}>按题型统计</Title>
        <Row gutter={[16, 16]}>
          {Object.entries(stats.byType).map(([type, typeStats]) => (
            <Col span={8} key={type}>
              <Card size="small" title={type}>
                <Progress
                  type="circle"
                  percent={typeStats.accuracy || 0}
                  format={(percent?: number) => `${percent || 0}%`}
                />
                <div style={{ marginTop: '16px' }}>
                  <Text>总题数: {typeStats.total}</Text>
                  <br />
                  <Text>正确数: {typeStats.correct}</Text>
                  <br />
                  <Text>平均用时: {typeStats.averageTime?.toFixed(1)}秒</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default UserProgressComponent; 