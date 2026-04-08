const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');

// Получение всех настроек
router.get('/settings', isAdmin, async (req, res) => {
    try {
        const db = require('../utils/database');

        const settings = await db.all(`SELECT * FROM system_settings ORDER BY key_name`);

        res.json({ success: true, settings });
    } catch (error) {
        console.error('Ошибка получения настроек:', error);
        res.status(500).json({ success: false, error: 'Ошибка при получении настроек' });
    }
});

// Обновление настройки
router.put('/settings/:key', isAdmin, async (req, res) => {
    try {
        const db = require('../utils/database');
        const key = req.params.key;
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Значение обязательно' 
            });
        }

        await db.run(`
            UPDATE system_settings 
            SET value = ?, updated_at = ?
            WHERE key_name = ?
        `, [value, new Date().toISOString(), key]);

        res.json({ success: true, message: 'Настройка обновлена' });
    } catch (error) {
        console.error('Ошибка обновления настройки:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении настройки' });
    }
});

// Массовое обновление настроек
router.put('/settings/bulk', isAdmin, async (req, res) => {
    try {
        const db = require('../utils/database');
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            await db.run(`
                UPDATE system_settings 
                SET value = ?, updated_at = ?
                WHERE key_name = ?
            `, [value, new Date().toISOString(), key]);
        }

        res.json({ success: true, message: 'Настройки обновлены' });
    } catch (error) {
        console.error('Ошибка массового обновления:', error);
        res.status(500).json({ success: false, error: 'Ошибка при обновлении настроек' });
    }
});

module.exports = router;
