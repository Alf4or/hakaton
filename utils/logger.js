/**
 * Централизованная система логирования с использованием Winston
 * Заменяет console.log в production коде
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// Создаем директорию для логов если не существует
const logDir = path.dirname(config.logging.file);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Уровни логирования
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    verbose: 4,
};

const currentLevel = LOG_LEVELS[config.logging.level] || LOG_LEVELS.info;

// Форматирование timestamp
const getTimestamp = () => new Date().toISOString();

// Форматирование сообщения
const formatMessage = (level, message, meta = {}) => {
    const timestamp = getTimestamp();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
};

// Класс логгера
class Logger {
    constructor() {
        this.levels = LOG_LEVELS;
    }

    _shouldLog(level) {
        return this.levels[level] <= currentLevel;
    }

    _write(level, message, meta = {}) {
        if (!this._shouldLog(level)) return;

        const formattedMessage = formatMessage(level, message, meta);

        // Логирование в консоль
        if (config.logging.console) {
            const consoleMethod = level === 'error' ? 'error' : 
                                 level === 'warn' ? 'warn' : 'log';
            console[consoleMethod](formattedMessage);
        }

        // Логирование в файл
        this._writeToFile(formattedMessage);
    }

    _writeToFile(message) {
        fs.appendFile(config.logging.file, message + '\n', (err) => {
            if (err) {
                console.error('Ошибка записи в лог файл:', err);
            }
        });
    }

    error(message, meta = {}) {
        this._write('error', message, meta);
    }

    warn(message, meta = {}) {
        this._write('warn', message, meta);
    }

    info(message, meta = {}) {
        this._write('info', message, meta);
    }

    debug(message, meta = {}) {
        this._write('debug', message, meta);
    }

    verbose(message, meta = {}) {
        this._write('verbose', message, meta);
    }

    // Логирование HTTP запросов
    http(req, res, startTime) {
        const duration = Date.now() - startTime;
        this.info('HTTP Request', {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.session?.userId || null,
        });
    }

    // Логирование ошибок БД
    database(error, query, params = []) {
        this.error('Database Error', {
            message: error.message,
            query,
            params: params.length > 0 ? '[REDACTED]' : [],
            stack: error.stack,
        });
    }

    // Логирование аутентификации
    auth(action, userId, details = {}) {
        this.info(`Auth: ${action}`, {
            userId,
            ...details,
        });
    }

    // Логирование безопасности
    security(event, details = {}) {
        this.warn(`Security: ${event}`, details);
    }
}

// Экспортируем singleton
const logger = new Logger();

// Middleware для логирования HTTP запросов
function httpLogger(req, res, next) {
    const startTime = Date.now();
    
    res.on('finish', () => {
        logger.http(req, res, startTime);
    });
    
    next();
}

module.exports = logger;
module.exports.Logger = Logger;
module.exports.httpLogger = httpLogger;
module.exports.LOG_LEVELS = LOG_LEVELS;
