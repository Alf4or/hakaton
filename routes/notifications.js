const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// Получение уведомлений пользователя
router.get('/notifications', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const { unreadOnly = false, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE user_id = ?';
        const params = [req.session.userId];

        if (unreadOnly === 'true') {
            whereClause += ' AND is_read = 0';
        }

        const notifications = await db.all(`
            SELECT * FROM notifications
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const countResult = await db.get(`
            SELECT COUNT(*) as count FROM notifications ${whereClause.replace('WHERE', 'WHERE')}
        `, params);

        res.json({
            success: true,
            notifications,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil((countResult?.count || 0) / limit),
                totalNotifications: countResult?.count || 0
            }
        });
    } catch (error) {
        console.error('Ошибка получения уведомлений:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении уведомлений' });
    }
});

// Отметка уведомления как прочитанного
router.put('/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const notificationId = req.params.id;

        const result = await db.run(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE id = ? AND user_id = ?
        `, [notificationId, req.session.userId]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Уведомление не найдено' });
        }

        res.json({ success: true, message: 'Уведомление отмечено как прочитанное' });
    } catch (error) {
        console.error('Ошибка отметки уведомления:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении уведомления' });
    }
});

// Отметка всех уведомлений как прочитанных
router.put('/notifications/read-all', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');

        await db.run(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE user_id = ? AND is_read = 0
        `, [req.session.userId]);

        res.json({ success: true, message: 'Все уведомления отмечены как прочитанные' });
    } catch (error) {
        console.error('Ошибка отметки всех уведомлений:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении уведомлений' });
    }
});

// Удаление уведомления
router.delete('/notifications/:id', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const notificationId = req.params.id;

        const result = await db.run(`
            DELETE FROM notifications 
            WHERE id = ? AND user_id = ?
        `, [notificationId, req.session.userId]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Уведомление не найдено' });
        }

        res.json({ success: true, message: 'Уведомление удалено' });
    } catch (error) {
        console.error('Ошибка удаления уведомления:', error);
        res.status(500).json({ success: false, error: 'Ошибка при удалении уведомления' });
    }
});

// Создание уведомления (для внутреннего использования)
router.post('/notifications', isAuthenticated, async (req, res) => {
    try {
        // Только админы могут создавать уведомления
        if (req.session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Доступ запрещен' });
        }

        const db = require('../utils/database');
        const { userId, title, message, type = 'info' } = req.body;

        if (!userId || !title || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'userId, title и message обязательны' 
            });
        }

        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO notifications (user_id, title, message, type, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, title, message, type, now]);

        res.json({ success: true, message: 'Уведомление создано' });
    } catch (error) {
        console.error('Ошибка создания уведомления:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании уведомления' });
    }
});

// Массовая рассылка уведомлений (только для админов)
router.post('/notifications/broadcast', isAuthenticated, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Только для администраторов' });
        }

        const db = require('../utils/database');
        const { title, message, type = 'info', targetRole } = req.body;

        if (!title || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'title и message обязательны' 
            });
        }

        const now = new Date().toISOString();
        
        let users;
        if (targetRole) {
            users = await db.all(`SELECT id FROM users WHERE role = ?`, [targetRole]);
        } else {
            users = await db.all(`SELECT id FROM users`);
        }

        for (const user of users) {
            await db.run(`
                INSERT INTO notifications (user_id, title, message, type, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [user.id, title, message, type, now]);
        }

        res.json({ 
            success: true, 
            message: `Уведомление отправлено ${users.length} пользователям` 
        });
    } catch (error) {
        console.error('Ошибка массовой рассылки:', error);
        res.status(500).json({ success: false, error: 'Ошибка при рассылке уведомлений' });
    }
});

// Подсчет непрочитанных уведомлений
router.get('/notifications/unread/count', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');

        const result = await db.get(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE user_id = ? AND is_read = 0
        `, [req.session.userId]);

        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Ошибка подсчета уведомлений:', error);
        res.status(500).json({ success: false, error: 'Ошибка при подсчете уведомлений' });
    }
});

module.exports = router;
