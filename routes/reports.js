/**
 * Маршруты для генерации отчетов и статистики
 */

const express = require('express');
const router = express.Router();
const { isAdmin, isStaff, isAuthenticated } = require('../middleware/auth');
const db = require('../utils/database');

// ============================================
// ОБЩАЯ СТАТИСТИКА
// ============================================

router.get('/reports/dashboard', isAdmin, async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Пользователи
        const userStats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'banned' THEN 1 ELSE 0 END) as banned,
                SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
                SUM(CASE WHEN role = 'employee' THEN 1 ELSE 0 END) as employees
            FROM users
        `);

        // Тикеты
        const ticketStats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
            FROM support_tickets
        `);

        // Задачи
        const taskStats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent
            FROM tasks
        `);

        // Активность за неделю
        const weeklyActivity = await db.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM support_tickets
            WHERE created_at >= ?
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [weekAgo]);

        // Новые пользователи за месяц
        const newUsers = await db.get(`
            SELECT COUNT(*) as count FROM users WHERE created_at >= ?
        `, [monthAgo]);

        // Среднее время решения тикетов
        const avgResolutionTime = await db.get(`
            SELECT AVG(julianday(resolved_at) - julianday(created_at)) as avg_days
            FROM support_tickets
            WHERE resolved_at IS NOT NULL
        `);

        res.json({
            success: true,
            data: {
                users: userStats,
                tickets: ticketStats,
                tasks: taskStats,
                activity: {
                    weekly: weeklyActivity,
                    newUsers: newUsers.count,
                },
                performance: {
                    avgResolutionDays: avgResolutionTime?.avg_days || 0,
                },
            },
        });
    } catch (error) {
        console.error('Ошибка получения дашборда:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении статистики' });
    }
});

// ============================================
// ОТЧЕТ ПО ТИКЕТАМ
// ============================================

router.get('/reports/tickets', isAdmin, async (req, res) => {
    try {
        const { startDate, endDate, employeeId, status } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (startDate) {
            whereClause += ' AND created_at >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND created_at <= ?';
            params.push(endDate);
        }
        if (employeeId) {
            whereClause += ' AND assigned_to = ?';
            params.push(employeeId);
        }
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        const tickets = await db.all(`
            SELECT 
                t.*,
                u.username as author_name,
                emp.username as assigned_to_name,
                r.rating as review_rating
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users emp ON t.assigned_to = emp.id
            LEFT JOIN reviews r ON t.id = r.ticket_id
            ${whereClause}
            ORDER BY t.created_at DESC
        `, params);

        // Агрегированные данные
        const summary = {
            total: tickets.length,
            byStatus: {},
            byPriority: {},
            byCategory: {},
            avgRating: 0,
        };

        let ratingSum = 0;
        let ratingCount = 0;

        for (const ticket of tickets) {
            summary.byStatus[ticket.status] = (summary.byStatus[ticket.status] || 0) + 1;
            summary.byPriority[ticket.priority] = (summary.byPriority[ticket.priority] || 0) + 1;
            summary.byCategory[ticket.category || 'uncategorized'] = (summary.byCategory[ticket.category || 'uncategorized'] || 0) + 1;
            
            if (ticket.review_rating) {
                ratingSum += ticket.review_rating;
                ratingCount++;
            }
        }

        summary.avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : 0;

        res.json({
            success: true,
            tickets,
            summary,
        });
    } catch (error) {
        console.error('Ошибка отчета по тикетам:', error);
        res.status(500).json({ success: false, error: 'Ошибка при генерации отчета' });
    }
});

// ============================================
// ОТЧЕТ ПО СОТРУДНИКАМ
// ============================================

router.get('/reports/employees', isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let whereClause = '';
        const params = [];

        if (startDate) {
            whereClause += ' AND t.created_at >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND t.created_at <= ?';
            params.push(endDate);
        }

        const employees = await db.all(`
            SELECT 
                u.id,
                u.username,
                u.email,
                COUNT(t.id) as total_tickets,
                SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) as resolved_tickets,
                SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) as open_tickets,
                AVG(CASE WHEN t.resolved_at IS NOT NULL 
                    THEN julianday(t.resolved_at) - julianday(t.created_at) 
                    ELSE NULL END) as avg_resolution_days,
                COUNT(r.id) as total_reviews,
                AVG(r.rating) as avg_rating
            FROM users u
            LEFT JOIN support_tickets t ON u.id = t.assigned_to ${whereClause}
            LEFT JOIN reviews r ON t.id = r.ticket_id
            WHERE u.role IN ('admin', 'employee')
            GROUP BY u.id, u.username, u.email
            ORDER BY total_tickets DESC
        `, params);

        res.json({
            success: true,
            employees,
        });
    } catch (error) {
        console.error('Ошибка отчета по сотрудникам:', error);
        res.status(500).json({ success: false, error: 'Ошибка при генерации отчета' });
    }
});

// ============================================
// ЭКСПОРТ ДАННЫХ (CSV)
// ============================================

router.get('/reports/export/tickets', isAdmin, async (req, res) => {
    try {
        const tickets = await db.all(`
            SELECT 
                t.id,
                t.subject,
                t.status,
                t.priority,
                t.category,
                u.username as author,
                emp.username as assigned_to,
                t.created_at,
                t.resolved_at
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN users emp ON t.assigned_to = emp.id
            ORDER BY t.created_at DESC
            LIMIT 1000
        `);

        // Генерация CSV
        const headers = ['ID', 'Тема', 'Статус', 'Приоритет', 'Категория', 'Автор', 'Исполнитель', 'Создан', 'Решен'];
        const csvRows = [headers.join(',')];

        for (const ticket of tickets) {
            csvRows.push([
                ticket.id,
                `"${ticket.subject.replace(/"/g, '""')}"`,
                ticket.status,
                ticket.priority,
                ticket.category || '',
                ticket.author || '',
                ticket.assigned_to || '',
                ticket.created_at,
                ticket.resolved_at || '',
            ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=tickets_export.csv');
        res.send(csvRows.join('\n'));
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        res.status(500).json({ success: false, error: 'Ошибка при экспорте' });
    }
});

// ============================================
// АКТИВНОСТЬ ПОЛЬЗОВАТЕЛЕЙ
// ============================================

router.get('/reports/user-activity/:userId', isStaff, async (req, res) => {
    try {
        const userId = req.params.userId;

        // Тикеты пользователя
        const userTickets = await db.all(`
            SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `, [userId]);

        // Задачи пользователя
        const userTasks = await db.all(`
            SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `, [userId]);

        // Уведомления
        const notifications = await db.all(`
            SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `, [userId]);

        // Действия в audit log
        const auditLogs = await db.all(`
            SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `, [userId]);

        res.json({
            success: true,
            activity: {
                tickets: userTickets,
                tasks: userTasks,
                notifications: notifications.slice(0, 20),
                auditLogs: auditLogs.slice(0, 20),
            },
            summary: {
                totalTickets: userTickets.length,
                totalTasks: userTasks.length,
                totalNotifications: notifications.length,
                totalActions: auditLogs.length,
            },
        });
    } catch (error) {
        console.error('Ошибка получения активности:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении активности' });
    }
});

module.exports = router;
