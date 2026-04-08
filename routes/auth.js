const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAuthenticated, hasRole, validatePasswordStrength, auditLog } = require('../middleware/auth');

// Регистрация пользователя
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, isEmployee, position, adminPassword } = req.body;

        // Проверка наличия всех обязательных полей
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Все обязательные поля должны быть заполнены' 
            });
        }

        // Проверка сложности пароля
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                success: false, 
                error: passwordValidation.errors.join(', ') 
            });
        }

        // Проверка существующего пользователя
        const existingUser = await User.findByUsernameOrEmail(username);
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'Пользователь с таким именем или email уже существует' 
            });
        }

        let role = 'user';
        
        // Если регистрируется сотрудник
        if (isEmployee) {
            const correctAdminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
            if (adminPassword !== correctAdminPassword) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Неверный пароль администратора' 
                });
            }
            role = 'employee';
        }

        // Создание пользователя
        const userId = await User.create(username, email, password, role, position);

        // Логирование действия
        await logRegistration(userId, username, role, req);

        res.json({ 
            success: true, 
            message: 'Пользователь успешно зарегистрирован!',
            userId 
        });
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при регистрации пользователя' 
        });
    }
});

// Вход в систему
router.post('/login', async (req, res) => {
    try {
        const { usernameOrEmail, password } = req.body;

        if (!usernameOrEmail || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Введите логин и пароль' 
            });
        }

        const user = await User.findByUsernameOrEmail(usernameOrEmail);

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }

        // Проверка статуса пользователя
        if (user.status === 'banned') {
            return res.status(403).json({ 
                success: false, 
                error: 'Ваш аккаунт заблокирован. Обратитесь в поддержку.' 
            });
        }

        const passwordMatch = await User.validatePassword(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }

        // Установка сессии
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.email = user.email;

        // Обновление времени последнего входа
        await User.updateLastLogin(user.id);

        // Логирование входа
        await logLogin(user.id, req);

        // Определение маршрута для перенаправления
        let redirect = '/index.html';
        if (user.role === 'admin') {
            redirect = '/admin';
        } else if (user.role === 'employee') {
            redirect = '/employee-panel';
        }

        res.json({ 
            success: true, 
            role: user.role, 
            redirect,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка при входе в систему' 
        });
    }
});

// Выход из системы
router.post('/logout', (req, res) => {
    const userId = req.session?.userId;
    
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Ошибка при выходе' });
        }
        
        logLogout(userId);
        res.json({ success: true, message: 'Вы успешно вышли из системы' });
    });
});

// Получение текущего пользователя
router.get('/me', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        
        if (!user) {
            return res.status(404).json({ success: false, error: 'Пользователь не найден' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                position: user.position,
                bio: user.bio,
                created_at: user.created_at,
                last_login: user.last_login
            }
        });
    } catch (error) {
        console.error('Ошибка получения профиля:', error);
        res.status(500).json({ success: false, error: 'Ошибка сервера' });
    }
});

// Обновление профиля
router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const { username, email, position, bio } = req.body;
        
        await User.updateProfile(req.session.userId, {
            username,
            email,
            position,
            bio
        });

        await logProfileUpdate(req.session.userId, req);

        res.json({ success: true, message: 'Профиль успешно обновлен' });
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении профиля' });
    }
});

// Смена пароля
router.put('/change-password', isAuthenticated, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Введите текущий и новый пароль' 
            });
        }

        const user = await User.findById(req.session.userId);
        
        const passwordMatch = await User.validatePassword(currentPassword, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверный текущий пароль' 
            });
        }

        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                success: false, 
                error: passwordValidation.errors.join(', ') 
            });
        }

        await User.updatePassword(req.session.userId, newPassword);

        res.json({ success: true, message: 'Пароль успешно изменен' });
    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        res.status(500).json({ success: false, error: 'Ошибка при смене пароля' });
    }
});

// Удаление аккаунта
router.delete('/account', isAuthenticated, async (req, res) => {
    try {
        await User.delete(req.session.userId);
        
        req.session.destroy();
        
        res.json({ success: true, message: 'Аккаунт успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        res.status(500).json({ success: false, error: 'Ошибка при удалении аккаунта' });
    }
});

// Функции для логирования
async function logRegistration(userId, username, role, req) {
    try {
        const db = require('../utils/database');
        await db.run(`
            INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            userId,
            'register',
            'user',
            userId,
            JSON.stringify({ username, role }),
            req.ip,
            new Date().toISOString()
        ]);
    } catch (e) { console.error(e); }
}

async function logLogin(userId, req) {
    try {
        const db = require('../utils/database');
        await db.run(`
            INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            userId,
            'login',
            'user',
            userId,
            req.ip,
            new Date().toISOString()
        ]);
    } catch (e) { console.error(e); }
}

async function logLogout(userId) {
    try {
        const db = require('../utils/database');
        await db.run(`
            INSERT INTO audit_log (user_id, action, entity_type, created_at)
            VALUES (?, ?, ?, ?)
        `, [
            userId,
            'logout',
            'user',
            new Date().toISOString()
        ]);
    } catch (e) { console.error(e); }
}

async function logProfileUpdate(userId, req) {
    try {
        const db = require('../utils/database');
        await db.run(`
            INSERT INTO audit_log (user_id, action, entity_type, details, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            userId,
            'profile_update',
            'user',
            JSON.stringify(req.body),
            req.ip,
            new Date().toISOString()
        ]);
    } catch (e) { console.error(e); }
}

module.exports = router;
