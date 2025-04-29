import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import { toast } from 'react-toastify';

interface ProgressStats {
  totalQuestions: number;
  completedQuestions: number;
  correctAnswers: number;
  totalTimeSpent: number;
  averageTimeSpent: number;
  accuracy: number;
}

interface ProgressUpdateEvent {
  questionSetId: string;
  questionSet?: {
    id: string;
    title: string;
  };
  stats: ProgressStats;
}

interface ProgressMap {
  [key: string]: ProgressStats;
}

const ProfilePage: React.FC = () => {
  const { user } = useUser();
  const { socket } = useSocket();
  const [progressData, setProgressData] = useState<ProgressMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const handleProgressUpdate = useCallback((data: ProgressUpdateEvent) => {
    setProgressData(prev => ({
      ...prev,
      [data.questionSetId]: data.stats
    }));
  }, []);

  useEffect(() => {
    if (!socket || !user) return;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/user-progress/${user.id}`);
        if (!response.ok) throw new Error('Failed to fetch progress');
        const data = await response.json();
        
        if (data.success) {
          setProgressData(data.data);
        } else {
          throw new Error(data.message || 'Failed to fetch progress');
        }
      } catch (error) {
        toast.error('Failed to load progress data');
        console.error('Error fetching progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();

    socket.on('progress:update', handleProgressUpdate);

    return () => {
      socket.off('progress:update', handleProgressUpdate);
    };
  }, [socket, user, handleProgressUpdate]);

  if (isLoading) {
    return <div>Loading progress data...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Learning Progress</h1>
      {Object.entries(progressData).length === 0 ? (
        <p>No progress data available. Start practicing to see your progress!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(progressData).map(([questionSetId, stats]) => (
            <div key={questionSetId} className="bg-white p-4 rounded-lg shadow">
              <div className="space-y-2">
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-blue-600 rounded-full" 
                      style={{ 
                        width: `${Math.min((stats.completedQuestions / stats.totalQuestions) * 100, 100)}%` 
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Progress: {stats.completedQuestions}/{stats.totalQuestions} questions
                  </p>
                </div>
                <p>Correct Answers: {stats.correctAnswers}</p>
                <p>Accuracy: {stats.accuracy.toFixed(1)}%</p>
                <p>Average Time: {Math.round(stats.averageTimeSpent)} seconds</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;