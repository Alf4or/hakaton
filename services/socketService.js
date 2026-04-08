/**
 * Сервис WebSocket (Socket.IO) для real-time уведомлений
 * Поддержка комнат, событий, broadcasting
 */

const config = require('../config');
const logger = require('../utils/logger');

class SocketService {
    constructor() {
        this.io = null;
        this.userSockets = new Map(); // userId -> Set of socket ids
        this.connectedUsers = new Set();
    }

    /**
     * Инициализация Socket.IO сервера
     */
    initialize(server) {
        const { Server } = require('socket.io');
        
        this.io = new Server(server, {
            cors: {
                origin: config.socket.corsOrigin,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            pingTimeout: config.socket.pingTimeout,
            pingInterval: config.socket.pingInterval,
        });

        this.io.use((socket, next) => {
            // Проверка авторизации через сессию или токен
            const token = socket.handshake.auth.token;
            const userId = socket.handshake.auth.userId;
            
            if (!userId) {
                return next(new Error('Требуется авторизация'));
            }
            
            socket.userId = userId;
            next();
        });

        this.io.on('connection', (socket) => {
            this.handleConnection(socket);
        });

        logger.info('Socket.IO initialized');
        return this.io;
    }

    /**
     * Обработка подключения клиента
     */
    handleConnection(socket) {
        const userId = socket.userId;
        
        logger.info(`Socket connected: ${socket.id}`, { userId });

        // Добавляем пользователя в подключенные
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId).add(socket.id);
        this.connectedUsers.add(userId);

        // Присоединяем к личной комнате пользователя
        socket.join(`user:${userId}`);

        // Отправляем приветственное событие
        socket.emit('connected', {
            userId,
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });

        // Обработчики событий
        socket.on('join-room', (roomId) => {
            socket.join(roomId);
            logger.debug(`User ${userId} joined room ${roomId}`);
        });

        socket.on('leave-room', (roomId) => {
            socket.leave(roomId);
            logger.debug(`User ${userId} left room ${roomId}`);
        });

        socket.on('chat-message', async (data) => {
            await this.handleChatMessage(socket, data);
        });

        socket.on('typing-start', (roomId) => {
            socket.to(roomId).emit('user-typing', {
                userId,
                roomId,
            });
        });

        socket.on('typing-stop', (roomId) => {
            socket.to(roomId).emit('user-stopped-typing', {
                userId,
                roomId,
            });
        });

        socket.on('disconnect', () => {
            this.handleDisconnect(socket);
        });

        // Обновление статуса онлайн
        this.broadcastPresence(userId, true);
    }

    /**
     * Обработка отключения клиента
     */
    handleDisconnect(socket) {
        const userId = socket.userId;
        
        logger.info(`Socket disconnected: ${socket.id}`, { userId });

        if (this.userSockets.has(userId)) {
            this.userSockets.get(userId).delete(socket.id);
            
            // Если больше нет сокетов у пользователя
            if (this.userSockets.get(userId).size === 0) {
                this.userSockets.delete(userId);
                this.connectedUsers.delete(userId);
                this.broadcastPresence(userId, false);
            }
        }
    }

    /**
     * Трансляция статуса присутствия
     */
    broadcastPresence(userId, isOnline) {
        this.io.emit('presence-update', {
            userId,
            isOnline,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Обработка сообщений чата
     */
    async handleChatMessage(socket, data) {
        const { roomId, message, type = 'text' } = data;
        const userId = socket.userId;

        const chatMessage = {
            id: Date.now().toString(),
            roomId,
            userId,
            message,
            type,
            timestamp: new Date().toISOString(),
        };

        // Отправляем всем в комнате
        this.io.to(roomId).emit('chat-message', chatMessage);
        
        return chatMessage;
    }

    // ============================================
    // МЕТОДЫ ОТПРАВКИ УВЕДОМЛЕНИЙ
    // ============================================

    /**
     * Отправка уведомления конкретному пользователю
     */
    notifyUser(userId, event, data) {
        if (!this.userSockets.has(userId)) {
            logger.debug(`User ${userId} not connected, skipping notification`);
            return false;
        }

        const payload = {
            event,
            data,
            timestamp: new Date().toISOString(),
        };

        this.io.to(`user:${userId}`).emit(event, payload);
        logger.debug(`Notification sent to user ${userId}: ${event}`);
        return true;
    }

    /**
     * Отправка уведомления о новом тикете
     */
    notifyNewTicket(userId, ticket) {
        return this.notifyUser(userId, 'new-ticket', {
            ticketId: ticket.id,
            subject: ticket.subject,
            priority: ticket.priority,
            createdAt: ticket.created_at,
        });
    }

    /**
     * Отправка уведомления об ответе на тикет
     */
    notifyTicketResponse(userId, ticket, response) {
        return this.notifyUser(userId, 'ticket-response', {
            ticketId: ticket.id,
            subject: ticket.subject,
            responderId: response.user_id,
            message: response.message.substring(0, 100),
        });
    }

    /**
     * Отправка уведомления о задаче
     */
    notifyTask(userId, task, action) {
        return this.notifyUser(userId, 'task-update', {
            taskId: task.id,
            title: task.title,
            action, // created, updated, completed, deleted
            status: task.status,
        });
    }

    /**
     * Системное уведомление
     */
    notifySystem(userId, title, message, type = 'info') {
        return this.notifyUser(userId, 'system-notification', {
            title,
            message,
            type,
        });
    }

    /**
     * Отправка уведомления группе пользователей
     */
    notifyUsers(userIds, event, data) {
        let sent = 0;
        for (const userId of userIds) {
            if (this.notifyUser(userId, event, data)) {
                sent++;
            }
        }
        return sent;
    }

    /**
     * Broadcast всем подключенным
     */
    broadcast(event, data, excludeUserId = null) {
        const payload = {
            event,
            data,
            timestamp: new Date().toISOString(),
        };

        if (excludeUserId) {
            this.io.except(`user:${excludeUserId}`).emit(event, payload);
        } else {
            this.io.emit(event, payload);
        }

        logger.debug(`Broadcast: ${event}`);
    }

    /**
     * Broadcast сотрудникам/админам
     */
    broadcastToStaff(event, data) {
        // Можно расширить логику для отправки только сотрудникам
        return this.broadcast(event, data);
    }

    /**
     * Отправка в комнату
     */
    sendToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, {
            event,
            data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Получение списка онлайн пользователей
     */
    getOnlineUsers() {
        return Array.from(this.connectedUsers);
    }

    /**
     * Проверка онлайн статуса пользователя
     */
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }

    /**
     * Получение количества подключений пользователя
     */
    getUserConnections(userId) {
        return this.userSockets.has(userId) 
            ? this.userSockets.get(userId).size 
            : 0;
    }

    /**
     * Статистика подключений
     */
    getStats() {
        return {
            totalConnectedUsers: this.connectedUsers.size,
            totalSockets: Array.from(this.userSockets.values())
                .reduce((sum, sockets) => sum + sockets.size, 0),
            onlineUsers: Array.from(this.connectedUsers),
        };
    }
}

// Singleton
const socketService = new SocketService();

module.exports = socketService;
module.exports.SocketService = SocketService;
