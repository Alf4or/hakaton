const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.db');
const db = new sqlite3.Database(dbPath);

// Промисификация методов
db.run = promisify(db.run);
db.get = promisify(db.get);
db.all = promisify(db.all);

// Инициализация расширенной схемы базы данных
async function initializeDatabase() {
    // Таблица пользователей (расширенная)
    await db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            position TEXT,
            bio TEXT,
            avatar TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT,
            updated_at TEXT,
            last_login TEXT,
            two_factor_enabled INTEGER DEFAULT 0,
            two_factor_secret TEXT
        )
    `);

    // Таблица вопросов поддержки
    await db.run(`
        CREATE TABLE IF NOT EXISTS support_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            priority TEXT DEFAULT 'normal',
            category TEXT,
            assigned_to INTEGER,
            created_at TEXT,
            updated_at TEXT,
            resolved_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )
    `);

    // Таблица ответов на тикеты
    await db.run(`
        CREATE TABLE IF NOT EXISTS ticket_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER,
            user_id INTEGER,
            message TEXT NOT NULL,
            created_at TEXT,
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица уведомлений
    await db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица задач (расширенная)
    await db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT DEFAULT 'normal',
            status TEXT DEFAULT 'pending',
            due_date TEXT,
            completed_at TEXT,
            created_at TEXT,
            updated_at TEXT,
            tags TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица истории действий (audit log)
    await db.run(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id INTEGER,
            details TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица сессий
    await db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица рейтингов/отзывов
    await db.run(`
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            ticket_id INTEGER,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
        )
    `);

    // Таблица категорий FAQ
    await db.run(`
        CREATE TABLE IF NOT EXISTS faq_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            parent_id INTEGER,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (parent_id) REFERENCES faq_categories(id)
        )
    `);

    // Таблица статей FAQ
    await db.run(`
        CREATE TABLE IF NOT EXISTS faq_articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            keywords TEXT,
            views INTEGER DEFAULT 0,
            helpful_count INTEGER DEFAULT 0,
            not_helpful_count INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (category_id) REFERENCES faq_categories(id)
        )
    `);

    // Таблица чата в реальном времени
    await db.run(`
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            user_id INTEGER,
            message TEXT NOT NULL,
            is_system INTEGER DEFAULT 0,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица настроек системы
    await db.run(`
        CREATE TABLE IF NOT EXISTS system_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_name TEXT UNIQUE NOT NULL,
            value TEXT,
            type TEXT DEFAULT 'string',
            description TEXT,
            updated_at TEXT
        )
    `);

    // Добавление новых колонок в существующую таблицу users (если она уже существует)
    try {
        await db.run(`ALTER TABLE users ADD COLUMN bio TEXT`);
    } catch (e) { /* колонка уже существует */ }
    
    try {
        await db.run(`ALTER TABLE users ADD COLUMN avatar TEXT`);
    } catch (e) { /* колонка уже существует */ }
    
    try {
        await db.run(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
    } catch (e) { /* колонка уже существует */ }
    
    try {
        await db.run(`ALTER TABLE users ADD COLUMN created_at TEXT`);
    } catch (e) { /* колонка уже существует */ }
    
    try {
        await db.run(`ALTER TABLE users ADD COLUMN updated_at TEXT`);
    } catch (e) { /* колонка уже существует */ }
    
    try {
        await db.run(`ALTER TABLE users ADD COLUMN last_login TEXT`);
    } catch (e) { /* колонка уже существует */ }

    // Создание индексов для оптимизации
    await db.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON support_tickets(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id)`);

    // Добавление дефолтных настроек
    const defaultSettings = [
        ['maintenance_mode', 'false', 'boolean', 'Режим обслуживания'],
        ['registration_enabled', 'true', 'boolean', 'Разрешить регистрацию'],
        ['max_login_attempts', '5', 'integer', 'Максимум попыток входа'],
        ['session_timeout', '3600', 'integer', 'Таймаут сессии в секундах'],
        ['password_min_length', '8', 'integer', 'Минимальная длина пароля']
    ];

    for (const setting of defaultSettings) {
        await db.run(`
            INSERT OR IGNORE INTO system_settings (key_name, value, type, description, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `, [...setting, new Date().toISOString()]);
    }

    console.log('База данных успешно инициализирована');
}

module.exports = db;
module.exports.initializeDatabase = initializeDatabase;
