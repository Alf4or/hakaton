const express = require('express');
const router = express.Router();
const { isAuthenticated, isStaff } = require('../middleware/auth');

// Создание тикета поддержки
router.post('/tickets', isAuthenticated, async (req, res) => {
    try {
        const { subject, message, priority, category } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Тема и сообщение обязательны' 
            });
        }

        const db = require('../utils/database');
        const now = new Date().toISOString();
        
        const result = await db.run(`
            INSERT INTO support_tickets (user_id, subject, message, priority, category, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
        `, [req.session.userId, subject, message, priority || 'normal', category, now, now]);

        // Создаем уведомление для сотрудников
        const employees = await db.all(`SELECT id FROM users WHERE role IN ('admin', 'employee')`);
        for (const emp of employees) {
            await db.run(`
                INSERT INTO notifications (user_id, title, message, type, created_at)
                VALUES (?, ?, ?, 'ticket', ?)
            `, [emp.id, 'Новый тикет', `Тикет: ${subject}`, now]);
        }

        res.json({ 
            success: true, 
            message: 'Тикет успешно создан',
            ticketId: result.lastID
        });
    } catch (error) {
        console.error('Ошибка создания тикета:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании тикета' });
    }
});

// Получение списка тикетов пользователя
router.get('/tickets/my', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        
        const tickets = await db.all(`
            SELECT t.*, 
                   u.username as author_name,
                   emp.username as assigned_to_name
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users emp ON t.assigned_to = emp.id
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC
        `, [req.session.userId]);

        res.json({ success: true, tickets });
    } catch (error) {
        console.error('Ошибка получения тикетов:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении тикетов' });
    }
});

// Получение всех тикетов (для сотрудников)
router.get('/tickets', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const { status, priority, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];

        if (status) {
            whereClause += ' WHERE t.status = ?';
            params.push(status);
        }

        if (priority) {
            whereClause += whereClause ? ' AND t.priority = ?' : ' WHERE t.priority = ?';
            params.push(priority);
        }

        const query = `
            SELECT t.*, 
                   u.username as author_name,
                   emp.username as assigned_to_name
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users emp ON t.assigned_to = emp.id
            ${whereClause}
            ORDER BY 
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'normal' THEN 3 
                    ELSE 4 
                END,
                t.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const tickets = await db.all(query, [...params, parseInt(limit), parseInt(offset)]);

        const countResult = await db.get(`
            SELECT COUNT(*) as count FROM support_tickets t ${whereClause.replace('t.', '')}
        `, params);

        res.json({
            success: true,
            tickets,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(countResult.count / limit),
                totalTickets: countResult.count
            }
        });
    } catch (error) {
        console.error('Ошибка получения тикетов:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении тикетов' });
    }
});

// Получение конкретного тикета
router.get('/tickets/:id', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const ticketId = req.params.id;

        const ticket = await db.get(`
            SELECT t.*, 
                   u.username as author_name,
                   emp.username as assigned_to_name
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users emp ON t.assigned_to = emp.id
            WHERE t.id = ?
        `, [ticketId]);

        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Тикет не найден' });
        }

        // Проверка прав доступа
        const isOwner = ticket.user_id === req.session.userId;
        const isStaff = ['admin', 'employee'].includes(req.session.role);

        if (!isOwner && !isStaff) {
            return res.status(403).json({ success: false, error: 'Доступ запрещен' });
        }

        // Получаем ответы на тикет
        const responses = await db.all(`
            SELECT r.*, u.username
            FROM ticket_responses r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.ticket_id = ?
            ORDER BY r.created_at ASC
        `, [ticketId]);

        // Увеличиваем счетчик просмотров
        await db.run(`UPDATE support_tickets SET views = COALESCE(views, 0) + 1 WHERE id = ?`, [ticketId]);

        res.json({ success: true, ticket, responses });
    } catch (error) {
        console.error('Ошибка получения тикета:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении тикета' });
    }
});

// Добавление ответа в тикет
router.post('/tickets/:id/response', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const ticketId = req.params.id;
        const { message } = req.body;

        if (!message || message.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                error: 'Сообщение не может быть пустым' 
            });
        }

        const ticket = await db.get(`SELECT * FROM support_tickets WHERE id = ?`, [ticketId]);
        
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Тикет не найден' });
        }

        // Проверка прав доступа
        const isOwner = ticket.user_id === req.session.userId;
        const isStaffUser = ['admin', 'employee'].includes(req.session.role);

        if (!isOwner && !isStaffUser) {
            return res.status(403).json({ success: false, error: 'Доступ запрещен' });
        }

        const now = new Date().toISOString();
        
        await db.run(`
            INSERT INTO ticket_responses (ticket_id, user_id, message, created_at)
            VALUES (?, ?, ?, ?)
        `, [ticketId, req.session.userId, message, now]);

        // Обновляем время обновления тикета
        await db.run(`UPDATE support_tickets SET updated_at = ? WHERE id = ?`, [now, ticketId]);

        // Если отвечает сотрудник, уведомляем автора тикета
        if (isStaffUser && ticket.user_id !== req.session.userId) {
            await db.run(`
                INSERT INTO notifications (user_id, title, message, type, created_at)
                VALUES (?, ?, ?, 'ticket_response', ?)
            `, [ticket.user_id, 'Ответ на тикет', `Ваш тикет "${ticket.subject}" получил ответ`, now]);
        }

        res.json({ success: true, message: 'Ответ добавлен' });
    } catch (error) {
        console.error('Ошибка добавления ответа:', error);
        res.status(500).json({ success: false, error: 'Ошибка при добавлении ответа' });
    }
});

// Назначение исполнителя на тикет
router.put('/tickets/:id/assign', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const ticketId = req.params.id;
        const { assignedTo } = req.body;

        await db.run(`
            UPDATE support_tickets 
            SET assigned_to = ?, updated_at = ?
            WHERE id = ?
        `, [assignedTo, new Date().toISOString(), ticketId]);

        res.json({ success: true, message: 'Исполнитель назначен' });
    } catch (error) {
        console.error('Ошибка назначения исполнителя:', error);
        res.status(500).json({ success: false, error: 'Ошибка при назначении исполнителя' });
    }
});

// Изменение статуса тикета
router.put('/tickets/:id/status', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const ticketId = req.params.id;
        const { status } = req.body;

        if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Некорректный статус' 
            });
        }

        const updateData = {
            status,
            updated_at: new Date().toISOString()
        };

        if (status === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
        }

        const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updateData), ticketId];

        await db.run(`UPDATE support_tickets SET ${fields} WHERE id = ?`, values);

        res.json({ success: true, message: `Статус изменен на ${status}` });
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);
        res.status(500).json({ success: false, error: 'Ошибка при изменении статуса' });
    }
});

// Оценка тикета
router.post('/tickets/:id/review', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const ticketId = req.params.id;
        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ 
                success: false, 
                error: 'Рейтинг должен быть от 1 до 5' 
            });
        }

        // Проверяем, существует ли уже отзыв
        const existingReview = await db.get(
            `SELECT * FROM reviews WHERE ticket_id = ? AND user_id = ?`,
            [ticketId, req.session.userId]
        );

        const now = new Date().toISOString();

        if (existingReview) {
            await db.run(`
                UPDATE reviews SET rating = ?, comment = ?, created_at = ?
                WHERE ticket_id = ? AND user_id = ?
            `, [rating, comment, now, ticketId, req.session.userId]);
        } else {
            await db.run(`
                INSERT INTO reviews (user_id, ticket_id, rating, comment, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [req.session.userId, ticketId, rating, comment, now]);
        }

        res.json({ success: true, message: 'Отзыв сохранен' });
    } catch (error) {
        console.error('Ошибка сохранения отзыва:', error);
        res.status(500).json({ success: false, error: 'Ошибка при сохранении отзыва' });
    }
});

module.exports = router;
