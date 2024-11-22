const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); // Подключаем CORS
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const app = express();
const port = 3000;

// Подключение базы данных SQLite
const db = new sqlite3.Database('./database.db');
db.run = promisify(db.run);
db.get = promisify(db.get);
db.all = promisify(db.all);

// Middleware для обработки JSON и сессий
app.use(bodyParser.json());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));
// Обслуживание статических файлов HTML
app.use(express.static(path.join(__dirname, 'html')));

// Маршруты для статических файлов CSS и JS
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Корневой маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'index.html'));
});

// Функция для проверки роли
function ensureRole(requiredRole) {
    return (req, res, next) => {
        if (req.session.role === requiredRole) {
            next();
        } else {
            res.status(403).send('Доступ запрещен');
        }
    };
}

// Функция для создания таблицы пользователей
async function initializeDatabase() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            position TEXT
        )
    `);
}

// Регистрация пользователя
app.post('/register', async (req, res) => {
    const { username, email, password, isEmployee, position, adminPassword } = req.body;

    let role = 'user';
    if (isEmployee) {
        if (adminPassword !== 'admin1234') {
            return res.status(403).json({ success: false, error: 'Неверный пароль администратора' });
        }
        role = 'employee';
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
        await db.run(
            `INSERT INTO users (username, email, password, role, position) VALUES (?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, role, position || null]
        );
        res.json({ success: true, message: 'Пользователь успешно зарегистрирован!' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, error: 'Пользователь с таким именем или email уже существует' });
        }
        res.status(500).json({ success: false, error: 'Ошибка при регистрации пользователя' });
    }
});
// Установка EJS как шаблонизатор
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'html'));

// Парсер для обработки URL-кодированных данных (например, из форм)
app.use(express.urlencoded({ extended: true }));

// Маршрут для отображения административной панели
app.get('/admin', async (req, res) => {
    try {
        const users = await db.all('SELECT * FROM users'); // Получение всех пользователей
        res.render('admin', { users }); // Рендеринг admin.ejs с данными пользователей
    } catch (error) {
        console.error('Ошибка при получении пользователей:', error);
        res.status(500).send('Ошибка при получении пользователей.');
    }
});
// ВЫХОД ИЗ АДМИНКИ
app.post('/logout', (req, res) => {
    // Например, удалить сессию пользователя или выполнить другие необходимые действия
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Ошибка при выходе.');
        }
        res.redirect('/login.html');
    });
});
// ВЫЗОВ ПОВЫШЕНИЯ
app.post('/admin/promote/:id', (req, res) => {
    const userId = req.params.id;

    // Определите новую роль для повышения
    const newRole = "admin"; // Измените роль при необходимости

    db.run('UPDATE users SET role = ? WHERE id = ?', [newRole, userId], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка при обновлении роли');
        }

        // Перенаправление обратно на административную панель
        return res.redirect('/admin');
    });
});

// ВЫЗОВ УДАЛЕНИЯ
app.post('/admin/delete/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const result = await db.run('DELETE FROM users WHERE id = ?', userId);
        
        if (result.changes > 0) {
            return res.redirect('/admin');
        } else {
            return res.status(404).send('Пользователь не найден.');
        }
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        return res.status(500).send('Ошибка при удалении пользователя.');
    }
});
// Эндпоинт для сохранения вопросов
app.post('/save-question', (req, res) => {
    const question = req.body.question;
    if (!question) {
        return res.status(400).send('Нет вопроса для сохранения.');
    }

    // Здесь можно добавить код для сохранения вопроса
    fs.appendFile('unanswered_questions.json', question + '\n', (err) => {
        if (err) {
            console.error('Ошибка при сохранении вопроса:', err);
            return res.status(500).send('Ошибка при сохранении вопроса.');
        }
        res.status(200).send('Вопрос успешно сохранён.');
    });
});
// Эндпоинт для получения невостребованных вопросов
app.get('/get-questions', (req, res) => {
    const filePath = 'unanswered_questions.json';
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Ошибка при чтении файла:', err);
            return res.status(500).send('Ошибка при чтении файла.');
        }
        
        const questions = data.split('\n').filter((q) => q); // Разделение на вопросы и удаление пустых строк
        res.json(questions);
    });
});
// Логин пользователя
app.post('/login', async (req, res) => {
    const { usernameOrEmail, password } = req.body;

    try {
        const user = await db.get(
            `SELECT * FROM users WHERE username = ? OR email = ?`,
            [usernameOrEmail, usernameOrEmail]
        );

        if (!user) {
            return res.status(401).json({ success: false, error: 'Неверное имя пользователя или пароль' });
        }

        const passwordMatch = bcrypt.compareSync(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, error: 'Неверное имя пользователя или пароль' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        if (user.role === 'admin') {
            res.json({ success: true, role: 'admin', redirect: '/admin' });
        } else if (user.role === 'employee') {
            res.json({ success: true, role: 'employee', redirect: '/employee-panel' });
        } else {
            res.json({ success: true, role: 'user', redirect: '/chat' });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: 'Ошибка при входе в систему' });
    }
});






// Эндпоинт для получения FAQ
async function readFAQFile() {
    const filePath = path.join(__dirname, 'faq.json');
    try {
        const fileData = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(fileData);
    } catch (error) {
        console.error('Ошибка при чтении FAQ файла:', error);
        throw new Error('Ошибка при загрузке FAQ');
    }
}

app.get('/faq', async (req, res) => {
    try {
        const faqData = await readFAQFile();
        res.json(faqData);
    } catch (error) {
        res.status(500).json({ error: 'Не удалось загрузить FAQ' });
    }
});

// Запуск сервера
// Запуск сервера и инициализация базы данных
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Сервер запущен на http://localhost:${port}`);
    });
}).catch(error => {
    console.error('Ошибка инициализации базы данных:', error);
});