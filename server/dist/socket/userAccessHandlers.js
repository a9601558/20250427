"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUserAccessHandlers = void 0;
const User_1 = __importDefault(require("../models/User"));
const Purchase_1 = __importDefault(require("../models/Purchase"));
const logger_1 = __importDefault(require("../utils/logger"));
const registerUserAccessHandlers = (socket) => {
    // User access rights synchronization
    socket.on('user:syncAccessRights', async (data) => {
        try {
            const { userId } = data;
            if (!userId) {
                return;
            }
            logger_1.default.info(`User [${userId}] requesting access rights sync`);
            // Fetch user's purchases to determine access rights
            const user = await User_1.default.findByPk(userId, {
                include: [{
                        model: Purchase_1.default,
                        as: 'purchases'
                    }]
            });
            if (!user) {
                logger_1.default.warn(`User [${userId}] not found for access rights sync`);
                return;
            }
            // Build accessRights object
            const accessRights = {};
            if (user.purchases && user.purchases.length > 0) {
                const now = new Date();
                user.purchases.forEach((purchase) => {
                    if (!purchase.questionSetId)
                        return;
                    const expiryDate = purchase.expiryDate ? new Date(purchase.expiryDate) : null;
                    const isExpired = expiryDate && expiryDate <= now;
                    const isActive = purchase.status === 'active' || purchase.status === 'completed';
                    if (!isExpired && isActive) {
                        // Calculate remaining days
                        let remainingDays = undefined;
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
            logger_1.default.info(`Sent access rights sync to user [${userId}], ${Object.keys(accessRights).length} entries`);
        }
        catch (error) {
            logger_1.default.error('Error in user:syncAccessRights handler:', error);
        }
    });
    // Handle device sync requests
    socket.on('user:requestDeviceSync', async (data) => {
        try {
            const { userId, deviceInfo } = data;
            if (!userId) {
                return;
            }
            logger_1.default.info(`User [${userId}] requesting device sync, device info:`, deviceInfo);
            // Broadcast to other connected sockets for this user
            socket.to(`user_${userId}`).emit('user:deviceSync', {
                userId,
                deviceInfo,
                timestamp: new Date().toISOString()
            });
            logger_1.default.info(`Sent device sync event to other devices of user [${userId}]`);
        }
        catch (error) {
            logger_1.default.error('Error in user:requestDeviceSync handler:', error);
        }
    });
    // Enhanced questionSet:checkAccess handler for cross-device support
    socket.on('questionSet:checkAccess', async (data) => {
        try {
            const { userId, questionSetId, source } = data;
            if (!userId || !questionSetId) {
                return;
            }
            logger_1.default.info(`Checking access for user [${userId}] to question set [${questionSetId}], source: ${source || 'unknown'}`);
            // Check if user has purchased this question set
            const user = await User_1.default.findByPk(userId, {
                include: [{
                        model: Purchase_1.default,
                        as: 'purchases',
                        where: { questionSetId },
                        required: false
                    }]
            });
            if (!user) {
                logger_1.default.warn(`User [${userId}] not found for access check`);
                return;
            }
            let hasAccess = false;
            let remainingDays = undefined;
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
            logger_1.default.info(`Access check result for user [${userId}] to question set [${questionSetId}]: ${hasAccess}`);
        }
        catch (error) {
            logger_1.default.error('Error in questionSet:checkAccess handler:', error);
        }
    });
};
exports.registerUserAccessHandlers = registerUserAccessHandlers;
