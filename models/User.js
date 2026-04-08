const bcrypt = require('bcryptjs');
const db = require('../utils/database');

class User {
    // Создание пользователя
    static async create(username, email, password, role = 'user', position = null) {
        const hashedPassword = bcrypt.hashSync(password, 12);
        const result = await db.run(
            `INSERT INTO users (username, email, password, role, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, role, position, new Date().toISOString()]
        );
        return result.lastID;
    }

    // Поиск пользователя по ID
    static async findById(id) {
        return await db.get(`SELECT * FROM users WHERE id = ?`, [id]);
    }

    // Поиск пользователя по username или email
    static async findByUsernameOrEmail(identifier) {
        return await db.get(
            `SELECT * FROM users WHERE username = ? OR email = ?`,
            [identifier, identifier]
        );
    }

    // Проверка пароля
    static async validatePassword(password, hashedPassword) {
        return bcrypt.compareSync(password, hashedPassword);
    }

    // Обновление профиля пользователя
    static async updateProfile(id, data) {
        const fields = [];
        const values = [];
        
        if (data.username) {
            fields.push('username = ?');
            values.push(data.username);
        }
        if (data.email) {
            fields.push('email = ?');
            values.push(data.email);
        }
        if (data.position) {
            fields.push('position = ?');
            values.push(data.position);
        }
        if (data.bio) {
            fields.push('bio = ?');
            values.push(data.bio);
        }
        if (data.avatar) {
            fields.push('avatar = ?');
            values.push(data.avatar);
        }
        
        if (fields.length === 0) return false;
        
        values.push(id);
        await db.run(
            `UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE id = ?`,
            [...values, new Date().toISOString(), id]
        );
        return true;
    }

    // Обновление пароля
    static async updatePassword(id, newPassword) {
        const hashedPassword = bcrypt.hashSync(newPassword, 12);
        await db.run(
            `UPDATE users SET password = ?, updated_at = ? WHERE id = ?`,
            [hashedPassword, new Date().toISOString(), id]
        );
        return true;
    }

    // Удаление пользователя
    static async delete(id) {
        await db.run(`DELETE FROM users WHERE id = ?`, [id]);
        return true;
    }

    // Повышение роли
    static async promoteRole(id, newRole) {
        await db.run(
            `UPDATE users SET role = ?, updated_at = ? WHERE id = ?`,
            [newRole, new Date().toISOString(), id]
        );
        return true;
    }

    // Получение всех пользователей с пагинацией
    static async getAll(page = 1, limit = 10, search = '') {
        const offset = (page - 1) * limit;
        let query = `SELECT id, username, email, role, position, created_at, last_login, status FROM users`;
        const params = [];
        
        if (search) {
            query += ` WHERE username LIKE ? OR email LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        return await db.all(query, params);
    }

    // Подсчет общего количества пользователей
    static async getCount(search = '') {
        let query = `SELECT COUNT(*) as count FROM users`;
        const params = [];
        
        if (search) {
            query += ` WHERE username LIKE ? OR email LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
        }
        
        const result = await db.get(query, params);
        return result.count;
    }

    // Обновление статуса пользователя
    static async updateStatus(id, status) {
        await db.run(
            `UPDATE users SET status = ?, updated_at = ? WHERE id = ?`,
            [status, new Date().toISOString(), id]
        );
        return true;
    }

    // Обновление времени последнего входа
    static async updateLastLogin(id) {
        await db.run(
            `UPDATE users SET last_login = ? WHERE id = ?`,
            [new Date().toISOString(), id]
        );
    }

    // Поиск пользователей по роли
    static async findByRole(role) {
        return await db.all(`SELECT * FROM users WHERE role = ?`, [role]);
    }

    // Получение статистики пользователей
    static async getStats() {
        const total = await db.get(`SELECT COUNT(*) as count FROM users`);
        const byRole = await db.all(`SELECT role, COUNT(*) as count FROM users GROUP BY role`);
        const active = await db.get(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`);
        const banned = await db.get(`SELECT COUNT(*) as count FROM users WHERE status = 'banned'`);
        
        return {
            total: total.count,
            byRole: byRole,
            active: active.count,
            banned: banned.count
        };
    }
}

module.exports = User;
