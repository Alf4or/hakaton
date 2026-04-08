/**
 * Маршруты для глобального поиска
 */

const express = require('express');
const router = express.Router();
const { isAuthenticated, isStaff } = require('../middleware/auth');
const db = require('../utils/database');

// ============================================
// ГЛОБАЛЬНЫЙ ПОИСК
// ============================================

router.get('/search', isAuthenticated, async (req, res) => {
    try {
        const { q, type = 'all', page = 1, limit = 20 } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Поисковый запрос должен содержать минимум 2 символа'
            });
        }

        const offset = (page - 1) * limit;
        const searchPattern = `%${q}%`;
        const results = {};

        // Поиск пользователей
        if (type === 'all' || type === 'users') {
            results.users = await db.all(`
                SELECT id, username, email, role, position, status
                FROM users
                WHERE username LIKE ? OR email LIKE ?
                LIMIT ?
            `, [searchPattern, searchPattern, limit]);
        }

        // Поиск тикетов
        if (type === 'all' || type === 'tickets') {
            results.tickets = await db.all(`
                SELECT t.id, t.subject, t.status, t.priority, t.created_at,
                       u.username as author_name
                FROM support_tickets t
                LEFT JOIN users u ON t.user_id = u.id
                WHERE t.subject LIKE ? OR t.message LIKE ?
                ORDER BY t.created_at DESC
                LIMIT ?
            `, [searchPattern, searchPattern, limit]);
        }

        // Поиск задач
        if (type === 'all' || type === 'tasks') {
            results.tasks = await db.all(`
                SELECT id, title, description, status, priority, due_date, created_at
                FROM tasks
                WHERE title LIKE ? OR description LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
            `, [searchPattern, searchPattern, limit]);
        }

        // Поиск FAQ статей
        if (type === 'all' || type === 'faq') {
            results.faq = await db.all(`
                SELECT a.id, a.title, a.content, c.name as category_name
                FROM faq_articles a
                LEFT JOIN faq_categories c ON a.category_id = c.id
                WHERE a.title LIKE ? OR a.content LIKE ?
                LIMIT ?
            `, [searchPattern, searchPattern, limit]);
        }

        // Подсчет результатов
        let totalResults = 0;
        for (const key in results) {
            totalResults += results[key].length;
        }

        res.json({
            success: true,
            query: q,
            type,
            totalResults,
            results,
        });
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ success: false, error: 'Ошибка при поиске' });
    }
});

// ============================================
// БЫСТРЫЙ ПОИСК (autocomplete)
// ============================================

router.get('/search/suggest', isAuthenticated, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim().length < 2) {
            return res.status(400).json({ success: false, suggestions: [] });
        }

        const searchPattern = `%${q}%`;
        const suggestions = [];

        // Пользователи
        const users = await db.all(`
            SELECT id, username, email, role
            FROM users
            WHERE username LIKE ?
            LIMIT 5
        `, [searchPattern]);
        
        suggestions.push({
            type: 'users',
            items: users.map(u => ({ id: u.id, label: u.username, sublabel: u.email }))
        });

        // Тикеты
        const tickets = await db.all(`
            SELECT id, subject, status
            FROM support_tickets
            WHERE subject LIKE ?
            LIMIT 5
        `, [searchPattern]);
        
        suggestions.push({
            type: 'tickets',
            items: tickets.map(t => ({ id: t.id, label: t.subject, sublabel: `#${t.id} - ${t.status}` }))
        });

        // Задачи
        const tasks = await db.all(`
            SELECT id, title, status
            FROM tasks
            WHERE title LIKE ?
            LIMIT 5
        `, [searchPattern]);
        
        suggestions.push({
            type: 'tasks',
            items: tasks.map(t => ({ id: t.id, label: t.title, sublabel: t.status }))
        });

        res.json({
            success: true,
            query: q,
            suggestions,
        });
    } catch (error) {
        console.error('Ошибка подсказок:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении подсказок' });
    }
});

// ============================================
// РАСШИРЕННЫЙ ПОИСК С ФИЛЬТРАМИ
// ============================================

router.post('/search/advanced', isStaff, async (req, res) => {
    try {
        const {
            entityType,
            filters = {},
            sortBy = 'created_at',
            sortOrder = 'DESC',
            page = 1,
            limit = 20
        } = req.body;

        const offset = (page - 1) * limit;
        let query = '';
        let params = [];

        switch (entityType) {
            case 'tickets':
                query = buildTicketSearchQuery(filters, sortBy, sortOrder, limit, offset);
                params = buildTicketSearchParams(filters);
                break;
            case 'users':
                query = buildUserSearchQuery(filters, sortBy, sortOrder, limit, offset);
                params = buildUserSearchParams(filters);
                break;
            case 'tasks':
                query = buildTaskSearchQuery(filters, sortBy, sortOrder, limit, offset);
                params = buildTaskSearchParams(filters);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'Неверный тип сущности'
                });
        }

        const results = await db.all(query, params);
        const countResult = await db.get(buildCountQuery(entityType, filters), params.slice(0, params.length - 2));

        res.json({
            success: true,
            results,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil((countResult?.count || 0) / limit),
                totalResults: countResult?.count || 0,
            },
        });
    } catch (error) {
        console.error('Ошибка расширенного поиска:', error);
        res.status(500).json({ success: false, error: 'Ошибка при поиске' });
    }
});

// Вспомогательные функции
function buildTicketSearchQuery(filters, sortBy, sortOrder, limit, offset) {
    let whereClauses = [];
    
    if (filters.status) whereClauses.push('t.status = ?');
    if (filters.priority) whereClauses.push('t.priority = ?');
    if (filters.category) whereClauses.push('t.category = ?');
    if (filters.assignedTo) whereClauses.push('t.assigned_to = ?');
    if (filters.authorId) whereClauses.push('t.user_id = ?');
    if (filters.dateFrom) whereClauses.push('t.created_at >= ?');
    if (filters.dateTo) whereClauses.push('t.created_at <= ?');

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return `
        SELECT t.*, u.username as author_name, emp.username as assigned_to_name
        FROM support_tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users emp ON t.assigned_to = emp.id
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
    `;
}

function buildTicketSearchParams(filters) {
    const params = [];
    if (filters.status) params.push(filters.status);
    if (filters.priority) params.push(filters.priority);
    if (filters.category) params.push(filters.category);
    if (filters.assignedTo) params.push(filters.assignedTo);
    if (filters.authorId) params.push(filters.authorId);
    if (filters.dateFrom) params.push(filters.dateFrom);
    if (filters.dateTo) params.push(filters.dateTo);
    return params;
}

function buildUserSearchQuery(filters, sortBy, sortOrder, limit, offset) {
    let whereClauses = [];
    
    if (filters.role) whereClauses.push('role = ?');
    if (filters.status) whereClauses.push('status = ?');
    if (filters.search) whereClauses.push('(username LIKE ? OR email LIKE ?)');

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return `
        SELECT id, username, email, role, position, status, created_at, last_login
        FROM users
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
    `;
}

function buildUserSearchParams(filters) {
    const params = [];
    if (filters.role) params.push(filters.role);
    if (filters.status) params.push(filters.status);
    if (filters.search) {
        params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    return params;
}

function buildTaskSearchQuery(filters, sortBy, sortOrder, limit, offset) {
    let whereClauses = [];
    
    if (filters.status) whereClauses.push('status = ?');
    if (filters.priority) whereClauses.push('priority = ?');
    if (filters.userId) whereClauses.push('user_id = ?');
    if (filters.dueDateFrom) whereClauses.push('due_date >= ?');
    if (filters.dueDateTo) whereClauses.push('due_date <= ?');

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return `
        SELECT * FROM tasks
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
    `;
}

function buildTaskSearchParams(filters) {
    const params = [];
    if (filters.status) params.push(filters.status);
    if (filters.priority) params.push(filters.priority);
    if (filters.userId) params.push(filters.userId);
    if (filters.dueDateFrom) params.push(filters.dueDateFrom);
    if (filters.dueDateTo) params.push(filters.dueDateTo);
    return params;
}

function buildCountQuery(entityType, filters) {
    switch (entityType) {
        case 'tickets':
            return `SELECT COUNT(*) as count FROM support_tickets t ${buildWhereClause(filters)}`;
        case 'users':
            return `SELECT COUNT(*) as count FROM users ${buildWhereClause(filters)}`;
        case 'tasks':
            return `SELECT COUNT(*) as count FROM tasks ${buildWhereClause(filters)}`;
        default:
            return 'SELECT 0 as count';
    }
}

function buildWhereClause(filters) {
    // Упрощенная версия для count
    return '';
}

module.exports = router;
