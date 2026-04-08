const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isAdmin, isStaff, auditLog } = require('../middleware/auth');

// Получение списка пользователей с пагинацией и поиском
router.get('/users', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';

        const [users, total] = await Promise.all([
            User.getAll(page, limit, search),
            User.getCount(search)
        ]);

        res.json({
            success: true,
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении пользователей' });
    }
});

// Повышение роли пользователя
router.post('/promote/:id', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { newRole } = req.body;

        if (!newRole || !['user', 'employee', 'admin'].includes(newRole)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Некорректная роль' 
            });
        }

        // Нельзя понизить последнего админа
        if (newRole !== 'admin') {
            const admins = await User.findByRole('admin');
            if (admins.length === 1 && admins[0].id == userId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Нельзя понизить последнего администратора' 
                });
            }
        }

        await User.promoteRole(userId, newRole);

        res.json({ 
            success: true, 
            message: `Роль пользователя успешно изменена на ${newRole}` 
        });
    } catch (error) {
        console.error('Ошибка изменения роли:', error);
        res.status(500).json({ success: false, error: 'Ошибка при изменении роли' });
    }
});

// Удаление пользователя
router.delete('/users/:id', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Нельзя удалить самого себя
        if (userId == req.session.userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Нельзя удалить собственный аккаунт' 
            });
        }

        await User.delete(userId);

        res.json({ success: true, message: 'Пользователь успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        res.status(500).json({ success: false, error: 'Ошибка при удалении пользователя' });
    }
});

// Блокировка/разблокировка пользователя
router.put('/users/:id/status', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { status } = req.body;

        if (!status || !['active', 'banned', 'suspended'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Некорректный статус' 
            });
        }

        if (userId == req.session.userId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Нельзя изменить собственный статус' 
            });
        }

        await User.updateStatus(userId, status);

        res.json({ 
            success: true, 
            message: `Статус пользователя изменен на ${status}` 
        });
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);
        res.status(500).json({ success: false, error: 'Ошибка при изменении статуса' });
    }
});

// Получение статистики пользователей
router.get('/stats', isAdmin, async (req, res) => {
    try {
        const stats = await User.getStats();
        
        // Дополнительная статистика
        const db = require('../utils/database');
        
        const ticketsStats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
            FROM support_tickets
        `);

        const tasksStats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent
            FROM tasks
        `);

        res.json({
            success: true,
            stats: {
                users: stats,
                tickets: ticketsStats,
                tasks: tasksStats
            }
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении статистики' });
    }
});

// Получение журнала аудита
router.get('/audit-log', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const db = require('../utils/database');
        
        const [logs, total] = await Promise.all([
            db.all(`
                SELECT a.*, u.username 
                FROM audit_log a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]),
            db.get(`SELECT COUNT(*) as count FROM audit_log`)
        ]);

        res.json({
            success: true,
            logs,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total.count / limit),
                totalLogs: total.count
            }
        });
    } catch (error) {
        console.error('Ошибка получения журнала аудита:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении журнала' });
    }
});

// Поиск пользователей
router.get('/users/search', isStaff, async (req, res) => {
    try {
        const query = req.query.q || '';
        
        if (query.length < 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'Поисковый запрос должен содержать минимум 2 символа' 
            });
        }

        const db = require('../utils/database');
        const users = await db.all(`
            SELECT id, username, email, role, position 
            FROM users 
            WHERE username LIKE ? OR email LIKE ?
            LIMIT 10
        `, [`%${query}%`, `%${query}%`]);

        res.json({ success: true, users });
    } catch (error) {
        console.error('Ошибка поиска пользователей:', error);
        res.status(500).json({ success: false, error: 'Ошибка при поиске' });
    }
});

// Массовое действие с пользователями
router.post('/users/bulk-action', isAdmin, async (req, res) => {
    try {
        const { userIds, action } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Необходимо выбрать пользователей' 
            });
        }

        if (!['delete', 'ban', 'activate', 'promote'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Некорректное действие' 
            });
        }

        const db = require('../utils/database');

        for (const userId of userIds) {
            if (userId == req.session.userId) continue; // Пропускаем текущего пользователя

            switch (action) {
                case 'delete':
                    await User.delete(userId);
                    break;
                case 'ban':
                    await User.updateStatus(userId, 'banned');
                    break;
                case 'activate':
                    await User.updateStatus(userId, 'active');
                    break;
            }
        }

        res.json({ 
            success: true, 
            message: `Массовое действие "${action}" выполнено для ${userIds.length} пользователей` 
        });
    } catch (error) {
        console.error('Ошибка массового действия:', error);
        res.status(500).json({ success: false, error: 'Ошибка при выполнении массового действия' });
    }
});

module.exports = router;
