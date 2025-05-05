import { Socket } from 'socket.io';
import User from '../models/User';
import Purchase from '../models/Purchase';
import logger from '../utils/logger';

export const registerUserAccessHandlers = (socket: Socket) => {
  // User access rights synchronization
  socket.on('user:syncAccessRights', async (data: { userId: string }) => {
    try {
      const { userId } = data;
      
      if (!userId) {
        return;
      }

      logger.info(`User [${userId}] requesting access rights sync`);
      
      // Fetch user's purchases to determine access rights
      const user = await User.findByPk(userId, {
        include: [{
          model: Purchase,
          as: 'purchases'
        }]
      });

      if (!user) {
        logger.warn(`User [${userId}] not found for access rights sync`);
        return;
      }

      // Build accessRights object
      const accessRights: {[key: string]: {hasAccess: boolean, remainingDays?: number}} = {};
      
      if (user.purchases && user.purchases.length > 0) {
        const now = new Date();
        
        user.purchases.forEach((purchase) => {
          if (!purchase.questionSetId) return;
          
          const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
          const isExpired = expiryDate && expiryDate <= now;
          const isActive = purchase.status === 'active' || purchase.status === 'completed';
          
          if (!isExpired && isActive) {
            // Calculate remaining days
            let remainingDays: number | undefined = undefined;
            
            if (expiryDate) {
              const diffTime = expiryDate.getTime() - now.getTime();
              remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            
            // Add to access rights object
            accessRights[purchase.questionSetId] = {
              hasAccess: true,
              remainingDays
            };
          }
        });
      }
      
      // Send access rights back to the user
      socket.emit('user:accessRightsSync', {
        userId,
        accessRights,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Sent access rights sync to user [${userId}], ${Object.keys(accessRights).length} entries`);
    } catch (error) {
      logger.error('Error in user:syncAccessRights handler:', error);
    }
  });

  // Handle device sync requests
  socket.on('user:requestDeviceSync', async (data: { userId: string, deviceInfo: any }) => {
    try {
      const { userId, deviceInfo } = data;
      
      if (!userId) {
        return;
      }
      
      logger.info(`User [${userId}] requesting device sync, device info:`, deviceInfo);
      
      // Broadcast to other connected sockets for this user
      socket.to(`user_${userId}`).emit('user:deviceSync', {
        userId,
        deviceInfo,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Sent device sync event to other devices of user [${userId}]`);
    } catch (error) {
      logger.error('Error in user:requestDeviceSync handler:', error);
    }
  });

  // Enhanced questionSet:checkAccess handler for cross-device support
  socket.on('questionSet:checkAccess', async (data: { userId: string, questionSetId: string, source?: string }) => {
    try {
      const { userId, questionSetId, source } = data;
      
      if (!userId || !questionSetId) {
        return;
      }
      
      logger.info(`Checking access for user [${userId}] to question set [${questionSetId}], source: ${source || 'unknown'}`);
      
      // Check if user has purchased this question set
      const user = await User.findByPk(userId, {
        include: [{
          model: Purchase,
          as: 'purchases',
          where: { questionSetId },
          required: false
        }]
      });
      
      if (!user) {
        logger.warn(`User [${userId}] not found for access check`);
        return;
      }
      
      let hasAccess = false;
      let remainingDays: number | undefined = undefined;
      
      if (user.purchases && user.purchases.length > 0) {
        const now = new Date();
        const purchase = user.purchases[0]; // Get the first matching purchase
        
        const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
        const isExpired = expiryDate && expiryDate <= now;
        const isActive = purchase.status === 'active' || purchase.status === 'completed';
        
        hasAccess = !isExpired && isActive;
        
        // Calculate remaining days if access is valid
        if (hasAccess && expiryDate) {
          const diffTime = expiryDate.getTime() - now.getTime();
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      }
      
      // Emit access status back to the requesting socket
      socket.emit('questionSet:accessUpdate', {
        questionSetId,
        hasAccess,
        remainingDays,
        source: 'server-check'
      });
      
      // Also broadcast to other connected sockets for this user
      socket.to(`user_${userId}`).emit('questionSet:accessUpdate', {
        questionSetId,
        hasAccess,
        remainingDays,
        source: 'cross-device-sync'
      });
      
      logger.info(`Access check result for user [${userId}] to question set [${questionSetId}]: ${hasAccess}`);
    } catch (error) {
      logger.error('Error in questionSet:checkAccess handler:', error);
    }
  });
}; 