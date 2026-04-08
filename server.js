const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { initializeDatabase } = require('./utils/database');

// Импорт маршрутов
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const ticketRoutes = require('./routes/tickets');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');
const faqRoutes = require('./routes/faq');
const settingsRoutes = require('./routes/settings');

// Импорт middleware
const { rateLimit, csrfToken, maintenanceMode } = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

// Настройка EJS как шаблонизатора
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'html'));

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 60000, maxRequests: 100 }));
app.use('/login', rateLimit({ windowMs: 300000, maxRequests: 10 }));
app.use('/register', rateLimit({ windowMs: 300000, maxRequests: 5 }));

// CSRF защита
app.use(csrfToken);
app.use(maintenanceMode);

// Сессии
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ============================================
// СТАТИЧЕСКИЕ ФАЙЛЫ
// ============================================

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'html')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// ============================================
// API МАРШРУТЫ
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', ticketRoutes);
app.use('/api', taskRoutes);
app.use('/api', notificationRoutes);
app.use('/api', faqRoutes);
app.use('/api', settingsRoutes);

// ============================================
// СТАРЫЕ МАРШРУТЫ (обратная совместимость)
// ============================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'html', 'index.html')));

app.get('/admin', async (req, res) => {
    if (!req.session.userId || req.session.role !== 'admin') {
        return res.status(403).send('Доступ запрещен');
    }
    try {
        const db = require('./utils/database');
        const users = await db.all('SELECT id, username, email, role, position, status, created_at FROM users');
        res.render('admin', { users });
    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).send('Ошибка.');
    }
});

app.post('/login', async (req, res) => {
    const { usernameOrEmail, password } = req.body;
    try {
        const db = require('./utils/database');
        const bcrypt = require('bcryptjs');
        const user = await db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [usernameOrEmail, usernameOrEmail]);
        if (!user) return res.status(401).json({ success: false, error: 'Неверные данные' });
        if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ success: false, error: 'Неверные данные' });
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        
        let redirect = '/index.html';
        if (user.role === 'admin') redirect = '/admin';
        else if (user.role === 'employee') redirect = '/employee-panel';
        
        res.json({ success: true, role: user.role, redirect });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка входа' });
    }
});

app.post('/register', async (req, res) => {
    const { username, email, password, isEmployee, position, adminPassword } = req.body;
    let role = 'user';
    if (isEmployee && adminPassword !== 'admin1234') {
        return res.status(403).json({ success: false, error: 'Неверный пароль админа' });
    }
    if (isEmployee) role = 'employee';
    
    try {
        const db = require('./utils/database');
        const bcrypt = require('bcryptjs');
        await db.run(`INSERT INTO users (username, email, password, role, position) VALUES (?, ?, ?, ?, ?)`,
            [username, email, bcrypt.hashSync(password, 10), role, position]);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, error: 'Ошибка регистрации' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => err ? res.status(500).send('Ошибка') : res.redirect('/login.html'));
});

app.post('/admin/promote/:id', (req, res) => {
    const db = require('./utils/database');
    db.run('UPDATE users SET role = ? WHERE id = ?', ['admin', req.params.id], err => 
        err ? res.status(500).send('Ошибка') : res.redirect('/admin'));
});

app.post('/admin/delete/:id', async (req, res) => {
    const db = require('./utils/database');
    try {
        const r = await db.run('DELETE FROM users WHERE id = ?', req.params.id);
        res.redirect(r.changes > 0 ? '/admin' : '/admin?error=notfound');
    } catch (e) { res.status(500).send('Ошибка'); }
});

app.post('/save-question', (req, res) => {
    const fs = require('fs');
    if (!req.body.question) return res.status(400).send('Нет вопроса');
    fs.appendFile('unanswered_questions.json', req.body.question + '\n', err => 
        err ? res.status(500).send('Ошибка') : res.send('OK'));
});

app.get('/get-questions', (req, res) => {
    const fs = require('fs');
    fs.readFile('unanswered_questions.json', 'utf8', (err, data) => {
        if (err) return res.status(500).send('Ошибка');
        res.json(data.split('\n').filter(q => q));
    });
});

app.get('/faq', async (req, res) => {
    try {
        const data = await require('fs').promises.readFile(path.join(__dirname, 'js', 'faq.json'), 'utf-8');
        res.json(JSON.parse(data));
    } catch (e) { res.status(500).json({ error: 'Ошибка FAQ' }); }
});

// Обработка 404 и ошибок
app.use((req, res) => res.status(404).send('404 - Страница не найдена'));
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка' });
});

// Запуск
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`\n============================================`);
        console.log(`Сервер запущен: http://localhost:${port}`);
        console.log(`============================================`);
        console.log(`API: /api/auth/*, /api/admin/*, /api/tickets/*`);
        console.log(`       /api/tasks/*, /api/notifications/*`);
        console.log(`       /api/faq/*, /api/settings/*`);
        console.log(`============================================\n`);
    });
}).catch(e => { console.error('Ошибка БД:', e); process.exit(1); });

module.exports = app;
