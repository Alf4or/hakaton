/**
 * Основной сервер приложения
 * Поддержка системы поддержки с расширенным функционалом
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Импорт конфигурации и утилит
const config = require('./config');
const logger = require('./utils/logger');
const { httpLogger } = require('./utils/logger');

// Импорт сервисов
const { emailService, socketService } = require('./services');

// Импорт маршрутов
const routes = require('./routes');

// Инициализация Express
const app = express();
const server = http.createServer(app);

// ============================================
// MIDDLEWARE
// ============================================

// CORS
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session({
    secret: config.security.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.env === 'production',
        httpOnly: true,
        maxAge: config.security.sessionTimeoutMs,
    },
}));

// HTTP логирование
app.use(httpLogger);

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// API ROUTES
// ============================================

const apiPrefix = config.api.prefix;

// Auth routes
app.use(`${apiPrefix}/auth`, routes.auth);

// Tickets routes
app.use(`${apiPrefix}`, routes.tickets);

// Tasks routes
app.use(`${apiPrefix}`, routes.tasks);

// Admin routes
app.use(`${apiPrefix}/admin`, routes.admin);

// Notifications routes
app.use(`${apiPrefix}`, routes.notifications);

// FAQ routes
app.use(`${apiPrefix}`, routes.faq);

// Settings routes
app.use(`${apiPrefix}`, routes.settings);

// Reports routes
app.use(`${apiPrefix}`, routes.reports);

// Search routes
app.use(`${apiPrefix}`, routes.search);

// ============================================
// HEALTH CHECK & STATUS
// ============================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.env,
    });
});

app.get('/status', async (req, res) => {
    const db = require('./utils/database');
    
    try {
        // Проверка БД
        await db.get('SELECT 1');
        
        res.json({
            status: 'healthy',
            services: {
                database: 'connected',
                email: emailService.initialized ? 'initialized' : 'disabled',
                socket: socketService.io ? 'connected' : 'disconnected',
            },
            stats: socketService.getStats(),
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
        });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
    });

    res.status(err.status || 500).json({
        success: false,
        error: config.env === 'development' ? err.message : 'Internal server error',
        ...(config.env === 'development' && { stack: err.stack }),
    });
});

// ============================================
// INITIALIZATION
// ============================================

async function initialize() {
    try {
        // Инициализация БД
        logger.info('Initializing database...');
        const db = require('./utils/database');
        await db.initializeDatabase();
        logger.info('Database initialized successfully');

        // Инициализация email сервиса
        logger.info('Initializing email service...');
        await emailService.initialize();

        // Инициализация Socket.IO
        logger.info('Initializing Socket.IO...');
        socketService.initialize(server);

        // Запуск сервера
        server.listen(config.port, () => {
            logger.info(`Server running on port ${config.port}`);
            logger.info(`Environment: ${config.env}`);
            logger.info(`API Prefix: ${config.api.prefix}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        logger.error('Failed to initialize server', { error: error.message, stack: error.stack });
        process.exit(1);
    }
}

function gracefulShutdown() {
    logger.info('Graceful shutdown initiated...');
    
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });

    // Force close after timeout
    setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
    }, 30000);
}

// ============================================
// START SERVER
// ============================================

initialize();

module.exports = { app, server };
