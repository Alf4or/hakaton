const express = require('express');
const router = express.Router();
const { isStaff } = require('../middleware/auth');

// Получение всех статей FAQ
router.get('/faq/articles', async (req, res) => {
    try {
        const db = require('../utils/database');
        const { categoryId, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params = [];

        if (categoryId) {
            whereClause = 'WHERE category_id = ?';
            params.push(categoryId);
        }

        if (search) {
            whereClause += whereClause ? ' AND ' : 'WHERE ';
            whereClause += '(title LIKE ? OR content LIKE ? OR keywords LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const articles = await db.all(`
            SELECT a.*, c.name as category_name
            FROM faq_articles a
            LEFT JOIN faq_categories c ON a.category_id = c.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        const countResult = await db.get(`
            SELECT COUNT(*) as count FROM faq_articles a
            ${whereClause.replace('a.', '')}
        `, params.slice(0, params.length - 2));

        res.json({
            success: true,
            articles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil((countResult?.count || 0) / limit),
                totalArticles: countResult?.count || 0
            }
        });
    } catch (error) {
        console.error('Ошибка получения статей FAQ:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении статей' });
    }
});

// Получение конкретной статьи
router.get('/faq/articles/:id', async (req, res) => {
    try {
        const db = require('../utils/database');
        const articleId = req.params.id;

        const article = await db.get(`
            SELECT a.*, c.name as category_name
            FROM faq_articles a
            LEFT JOIN faq_categories c ON a.category_id = c.id
            WHERE a.id = ?
        `, [articleId]);

        if (!article) {
            return res.status(404).json({ success: false, error: 'Статья не найдена' });
        }

        // Увеличиваем счетчик просмотров
        await db.run(`UPDATE faq_articles SET views = views + 1 WHERE id = ?`, [articleId]);

        res.json({ success: true, article });
    } catch (error) {
        console.error('Ошибка получения статьи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении статьи' });
    }
});

// Создание статьи FAQ (только для сотрудников)
router.post('/faq/articles', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const { title, content, categoryId, keywords } = req.body;

        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                error: 'Заголовок и содержание обязательны' 
            });
        }

        const now = new Date().toISOString();
        
        const result = await db.run(`
            INSERT INTO faq_articles (category_id, title, content, keywords, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [categoryId, title, content, keywords ? JSON.stringify(keywords) : null, now, now]);

        res.json({ 
            success: true, 
            message: 'Статья успешно создана',
            articleId: result.lastID
        });
    } catch (error) {
        console.error('Ошибка создания статьи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании статьи' });
    }
});

// Обновление статьи FAQ (только для сотрудников)
router.put('/faq/articles/:id', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const articleId = req.params.id;
        const { title, content, categoryId, keywords } = req.body;

        const updateFields = [];
        const values = [];

        if (title !== undefined) {
            updateFields.push('title = ?');
            values.push(title);
        }
        if (content !== undefined) {
            updateFields.push('content = ?');
            values.push(content);
        }
        if (categoryId !== undefined) {
            updateFields.push('category_id = ?');
            values.push(categoryId);
        }
        if (keywords !== undefined) {
            updateFields.push('keywords = ?');
            values.push(JSON.stringify(keywords));
        }

        updateFields.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(articleId);

        await db.run(`UPDATE faq_articles SET ${updateFields.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Статья обновлена' });
    } catch (error) {
        console.error('Ошибка обновления статьи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении статьи' });
    }
});

// Удаление статьи FAQ (только для сотрудников)
router.delete('/faq/articles/:id', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const articleId = req.params.id;

        await db.run(`DELETE FROM faq_articles WHERE id = ?`, [articleId]);

        res.json({ success: true, message: 'Статья удалена' });
    } catch (error) {
        console.error('Ошибка удаления статьи:', error);
        res.status(500).json({ success: false, error: 'Ошибка при удалении статьи' });
    }
});

// Оценка полезности статьи
router.post('/faq/articles/:id/feedback', async (req, res) => {
    try {
        const db = require('../utils/database');
        const articleId = req.params.id;
        const { helpful } = req.body;

        if (helpful === true) {
            await db.run(`UPDATE faq_articles SET helpful_count = helpful_count + 1 WHERE id = ?`, [articleId]);
        } else if (helpful === false) {
            await db.run(`UPDATE faq_articles SET not_helpful_count = not_helpful_count + 1 WHERE id = ?`, [articleId]);
        }

        res.json({ success: true, message: 'Спасибо за ваш отзыв!' });
    } catch (error) {
        console.error('Ошибка сохранения отзыва:', error);
        res.status(500).json({ success: false, error: 'Ошибка при сохранении отзыва' });
    }
});

// Категории FAQ
router.get('/faq/categories', async (req, res) => {
    try {
        const db = require('../utils/database');

        const categories = await db.all(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM faq_articles WHERE category_id = c.id) as article_count
            FROM faq_categories c
            ORDER BY c.sort_order, c.name
        `);

        res.json({ success: true, categories });
    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении категорий' });
    }
});

// Создание категории (только для сотрудников)
router.post('/faq/categories', isStaff, async (req, res) => {
    try {
        const db = require('../utils/database');
        const { name, description, parentId, sortOrder } = req.body;

        if (!name) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название категории обязательно' 
            });
        }

        const result = await db.run(`
            INSERT INTO faq_categories (name, description, parent_id, sort_order)
            VALUES (?, ?, ?, ?)
        `, [name, description, parentId, sortOrder || 0]);

        res.json({ 
            success: true, 
            message: 'Категория создана',
            categoryId: result.lastID
        });
    } catch (error) {
        console.error('Ошибка создания категории:', error);
        res.status(500).json({ success: false, error: 'Ошибка при создании категории' });
    }
});

module.exports = router;
