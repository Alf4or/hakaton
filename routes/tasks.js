const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

// Создание задачи
router.post('/tasks', isAuthenticated, async (req, res) => {
    try {
        const { title, description, priority, dueDate, tags } = req.body;

        if (!title) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название задачи обязательно' 
            });
        }

        const db = require('../utils/database');
        const now = new Date().toISOString();
        
        const result = await db.run(`
            INSERT INTO tasks (user_id, title, description, priority, status, due_date, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        `, [req.session.userId, title, description || '', priority || 'normal', dueDate || null, tags ? JSON.stringify(tags) : null, now, now]);

        res.json({ 
            success: true, 
            message: 'Задача успешно создана',
            taskId: result.lastID
        });
    } catch (error) {
        console.error('Ошибка создания задачи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании задачи' });
    }
});

// Получение списка задач пользователя
router.get('/tasks', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const { status, priority, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = ' WHERE user_id = ?';
        const params = [req.session.userId];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        if (priority) {
            whereClause += ' AND priority = ?';
            params.push(priority);
        }

        const tasks = await db.all(`
            SELECT * FROM tasks
            ${whereClause}
            ORDER BY 
                CASE priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'important' THEN 2 
                    WHEN 'normal' THEN 3 
                    ELSE 4 
                END,
                created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const countResult = await db.get(`
            SELECT COUNT(*) as count FROM tasks ${whereClause.replace('WHERE', 'WHERE').replace('user_id = ?', 'user_id = ?')}
        `, params.slice(0, 1 + (status ? 1 : 0) + (priority ? 1 : 0)));

        res.json({
            success: true,
            tasks,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil((countResult?.count || 0) / limit),
                totalTasks: countResult?.count || 0
            }
        });
    } catch (error) {
        console.error('Ошибка получения задач:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении задач' });
    }
});

// Получение конкретной задачи
router.get('/tasks/:id', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const taskId = req.params.id;

        const task = await db.get(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`, [taskId, req.session.userId]);

        if (!task) {
            return res.status(404).json({ success: false, error: 'Задача не найдена' });
        }

        res.json({ success: true, task });
    } catch (error) {
        console.error('Ошибка получения задачи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении задачи' });
    }
});

// Обновление задачи
router.put('/tasks/:id', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const taskId = req.params.id;
        const { title, description, priority, status, dueDate, tags } = req.body;

        // Проверяем, принадлежит ли задача пользователю
        const task = await db.get(`SELECT * FROM tasks WHERE id = ? AND user_id = ?`, [taskId, req.session.userId]);
        
        if (!task) {
            return res.status(404).json({ success: false, error: 'Задача не найдена' });
        }

        const updateFields = [];
        const values = [];

        if (title !== undefined) {
            updateFields.push('title = ?');
            values.push(title);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            values.push(description);
        }
        if (priority !== undefined) {
            updateFields.push('priority = ?');
            values.push(priority);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            values.push(status);
            if (status === 'completed') {
                updateFields.push('completed_at = ?');
                values.push(new Date().toISOString());
            }
        }
        if (dueDate !== undefined) {
            updateFields.push('due_date = ?');
            values.push(dueDate);
        }
        if (tags !== undefined) {
            updateFields.push('tags = ?');
            values.push(JSON.stringify(tags));
        }

        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(taskId);

        await db.run(`UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Задача успешно обновлена' });
    } catch (error) {
        console.error('Ошибка обновления задачи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении задачи' });
    }
});

// Удаление задачи
router.delete('/tasks/:id', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const taskId = req.params.id;

        const result = await db.run(`DELETE FROM tasks WHERE id = ? AND user_id = ?`, [taskId, req.session.userId]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Задача не найдена' });
        }

        res.json({ success: true, message: 'Задача успешно удалена' });
    } catch (error) {
        console.error('Ошибка удаления задачи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при удалении задачи' });
    }
});

// Завершение задачи
router.patch('/tasks/:id/complete', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');
        const taskId = req.params.id;
        const now = new Date().toISOString();

        const result = await db.run(`
            UPDATE tasks 
            SET status = 'completed', completed_at = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
        `, [now, now, taskId, req.session.userId]);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Задача не найдена' });
        }

        res.json({ success: true, message: 'Задача завершена' });
    } catch (error) {
        console.error('Ошибка завершения задачи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при завершении задачи' });
    }
});

// Статистика по задачам
router.get('/tasks/stats/summary', isAuthenticated, async (req, res) => {
    try {
        const db = require('../utils/database');

        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
                SUM(CASE WHEN priority = 'important' THEN 1 ELSE 0 END) as important
            FROM tasks
            WHERE user_id = ?
        `, [req.session.userId]);

        res.json({ success: true, stats });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении статистики' });
    }
});

module.exports = router;
