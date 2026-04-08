const crypto = require('crypto');

// Middleware для проверки аутентификации
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    return res.status(401).json({ success: false, error: 'Требуется авторизация' });
}

// Middleware для проверки роли
function hasRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.role) {
            return res.status(401).json({ success: false, error: 'Требуется авторизация' });
        }
        
        if (roles.includes(req.session.role)) {
            return next();
        }
        
        return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    };
}

// Middleware для проверки администратора
function isAdmin(req, res, next) {
    if (!req.session || !req.session.role) {
        return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }
    
    if (req.session.role === 'admin') {
        return next();
    }
    
    return res.status(403).json({ success: false, error: 'Доступ только для администраторов' });
}

// Middleware для проверки сотрудника или админа
function isStaff(req, res, next) {
    if (!req.session || !req.session.role) {
        return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }
    
    if (['admin', 'employee'].includes(req.session.role)) {
        return next();
    }
    
    return res.status(403).json({ success: false, error: 'Доступ только для сотрудников' });
}

// Middleware для логирования действий
function auditLog(action, entityType) {
    return (req, res, next) => {
        const originalSend = res.send;
        const originalJson = res.json;
        
        const logData = {
            userId: req.session?.userId || null,
            action,
            entityType,
            entityId: req.params?.id || null,
            details: JSON.stringify(req.body),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || '',
            timestamp: new Date().toISOString()
        };
        
        // Перехватываем ответ для логирования
        res.send = function(data) {
            logData.response = typeof data === 'string' ? data : JSON.stringify(data);
            logAudit(logData);
            return originalSend.call(this, data);
        };
        
        res.json = function(data) {
            logData.response = JSON.stringify(data);
            logAudit(logData);
            return originalJson.call(this, data);
        };
        
        next();
    };
}

// Функция для записи в audit log
async function logAudit(logData) {
    try {
        const db = require('../utils/database');
        await db.run(`
            INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            logData.userId,
            logData.action,
            logData.entityType,
            logData.entityId,
            logData.details,
            logData.ipAddress,
            logData.userAgent,
            logData.timestamp
        ]);
    } catch (error) {
        console.error('Ошибка при записи в audit log:', error);
    }
}

// Middleware для ограничения частоты запросов (rate limiting)
const rateLimitStore = new Map();

function rateLimit(options = {}) {
    const windowMs = options.windowMs || 60000; // 1 минута по умолчанию
    const maxRequests = options.maxRequests || 100;
    
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const record = rateLimitStore.get(key);
        
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + windowMs;
            return next();
        }
        
        record.count++;
        
        if (record.count > maxRequests) {
            return res.status(429).json({ 
                success: false, 
                error: 'Слишком много запросов. Попробуйте позже.' 
            });
        }
        
        next();
    };
}

// Очистка старых записей rate limit
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000);

// Middleware для проверки CSRF токена
function csrfProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    
    const csrfToken = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;
    
    if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
        return res.status(403).json({ 
            success: false, 
            error: 'Неверный CSRF токен' 
        });
    }
    
    next();
}

// Генерация CSRF токена
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Middleware для добавления CSRF токена в сессию
function csrfToken(req, res, next) {
    if (!req.session) {
        return next();
    }
    if (!req.session.csrfToken) {
        req.session.csrfToken = generateCsrfToken();
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

// Middleware для проверки режима обслуживания
async function maintenanceMode(req, res, next) {
    try {
        const db = require('../utils/database');
        const setting = await db.get(
            `SELECT value FROM system_settings WHERE key_name = 'maintenance_mode'`
        );
        
        if (setting && setting.value === 'true') {
            // Администраторы могут получить доступ даже в режиме обслуживания
            if (req.session?.role === 'admin') {
                return next();
            }
            
            return res.status(503).json({
                success: false,
                error: 'Система находится на техническом обслуживании. Попробуйте позже.'
            });
        }
        
        next();
    } catch (error) {
        console.error('Ошибка проверки режима обслуживания:', error);
        next();
    }
}

// Middleware для проверки сложности пароля
function validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < 8) {
        errors.push('Пароль должен содержать минимум 8 символов');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Пароль должен содержать хотя бы одну заглавную букву');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Пароль должен содержать хотя бы одну строчную букву');
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push('Пароль должен содержать хотя бы одну цифру');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Пароль должен содержать хотя бы один специальный символ');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    isAuthenticated,
    hasRole,
    isAdmin,
    isStaff,
    auditLog,
    rateLimit,
    csrfProtection,
    csrfToken,
    generateCsrfToken,
    maintenanceMode,
    validatePasswordStrength
};
