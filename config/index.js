/**
 * Централизованная конфигурация приложения
 * Использует переменные окружения с дефолтными значениями
 */

require('dotenv').config();

module.exports = {
    // ============================================
    // ОСНОВНЫЕ НАСТРОЙКИ
    // ============================================
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
    
    // ============================================
    // БЕЗОПАСНОСТЬ
    // ============================================
    security: {
        sessionSecret: process.env.SESSION_SECRET || 'fallback_secret_change_in_production',
        jwtSecret: process.env.JWT_SECRET || 'fallback_jwt_secret',
        encryptionKey: process.env.ENCRYPTION_KEY || 'fallback_encryption_key_32ch',
        adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
        bcryptRounds: 12,
        passwordMinLength: 8,
        maxLoginAttempts: 5,
        lockoutDurationMs: 15 * 60 * 1000, // 15 минут
        sessionTimeoutMs: 24 * 60 * 60 * 1000, // 24 часа
    },
    
    // ============================================
    // БАЗА ДАННЫХ
    // ============================================
    database: {
        path: process.env.DB_PATH || './database.db',
        poolSize: 10,
        acquireTimeout: 30000,
    },
    
    // ============================================
    // EMAIL (SMTP)
    // ============================================
    email: {
        enabled: !!process.env.SMTP_HOST,
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.EMAIL_FROM || 'noreply@system.com',
    },
    
    // ============================================
    // ФАЙЛЫ И ЗАГРУЗКИ
    // ============================================
    uploads: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
    },
    
    // ============================================
    // RATE LIMITING
    // ============================================
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
        loginWindowMs: 300000, // 5 минут
        loginMaxRequests: 10,
        registerWindowMs: 300000,
        registerMaxRequests: 5,
    },
    
    // ============================================
    // CORS
    // ============================================
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    },
    
    // ============================================
    // ЛОГИРОВАНИЕ
    // ============================================
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || './logs/app.log',
        console: true,
        maxFiles: 5,
        maxSize: '10m',
    },
    
    // ============================================
    // TWO FACTOR AUTH
    // ============================================
    twoFactor: {
        issuerName: process.env._FA_ISSUER_NAME || 'SupportSystem',
        window: 1,
        step: 30,
    },
    
    // ============================================
    // API
    // ============================================
    api: {
        keyHeader: process.env.API_KEY_HEADER || 'X-API-Key',
        masterApiKey: process.env.MASTER_API_KEY || 'change_in_production',
        version: 'v1',
        prefix: '/api',
    },
    
    // ============================================
    // REDIS (опционально)
    // ============================================
    redis: {
        enabled: !!process.env.REDIS_HOST,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || '',
        db: 0,
    },
    
    // ============================================
    // SOCKET.IO
    // ============================================
    socket: {
        corsOrigin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
        pingTimeout: 60000,
        pingInterval: 25000,
    },
    
    // ============================================
    // ПАГИНАЦИЯ ПО УМОЛЧАНИЮ
    // ============================================
    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },
};
