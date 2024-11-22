const express = require('express');
const sqlite3 = require('sqlite3');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const port = 3000;

// Создание HTTP-сервера для socket.io
const server = http.createServer(app);
const io = socketIo(server);

const db = new sqlite3.Database('./chatapp.db');

// Создание таблиц, если их нет
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      type TEXT,
      position TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      sender TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      message TEXT,
      answered BOOLEAN DEFAULT 0,
      employeeId INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users (id),
      FOREIGN KEY (employeeId) REFERENCES users (id)
    )
  `);
});

// Настройка сессий
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'asd')));

// Маршрут страницы входа
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/chat');
  }
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Маршрут страницы регистрации
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

// Логин пользователя
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
    if (err || !user) {
      return res.json({ success: false });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true });
  });
});

// Регистрация пользователя
app.post('/register', (req, res) => {
  const { username, password, isEmployee, position, adminPassword } = req.body;
  const userType = isEmployee ? 'employee' : 'user';

  if (isEmployee && adminPassword !== 'admin1234') {
    return res.json({ success: false });
  }

  db.run(
    "INSERT INTO users (username, password, type, position) VALUES (?, ?, ?, ?)",
    [username, password, userType, position],
    function (err) {
      if (err) {
        return res.json({ success: false });
      }
      res.json({ success: true });
    }
  );
});

// Получение сообщений
app.get('/getMessages', (req, res) => {
  const { userId } = req.query;

  db.all("SELECT messages.*, users.position FROM messages LEFT JOIN users ON messages.userId = users.id WHERE userId = ? OR sender = 'employee' ORDER BY timestamp ASC", [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Ошибка получения сообщений' });
    }
    res.json({ success: true, messages: rows });
  });
});

// Отправка сообщения
app.post('/sendMessage', (req, res) => {
  const { userId, message, sender } = req.body;

  if (!message || !userId || !sender) {
    return res.json({ success: false, error: 'Неполные данные' });
  }

  // Получаем имя пользователя и должность по его ID
  db.get("SELECT username, position FROM users WHERE id = ?", [userId], (err, row) => {
    if (err || !row) {
      return res.json({ success: false, error: 'Ошибка получения имени пользователя' });
    }

    // Вставляем сообщение в базу данных
    db.run("INSERT INTO messages (userId, sender, message) VALUES (?, ?, ?)", [userId, sender, message], function (err) {
      if (err) {
        return res.json({ success: false, error: 'Ошибка при сохранении сообщения' });
      }

      // Отправляем сообщение всем подключенным клиентам с должностью
      io.emit('message', { sender: row.username, message, position: row.position });
      res.json({ success: true });
    });
  });
});

// Маршрут страницы чата
app.get('/chat', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }

  // Получаем информацию о пользователе для рендеринга панели с чатами
  db.get("SELECT type FROM users WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user) {
      return res.redirect('/');
    }

    if (user.type === 'employee') {
      return res.sendFile(path.join(__dirname, 'employee_panel.html'));
    } else {
      return res.sendFile(path.join(__dirname, 'chat.html'));
    }
  });
});

// Получение списка пользователей для сотрудников
app.get('/getUsersForEmployee', (req, res) => {
  db.all("SELECT id, username FROM users WHERE type = 'user'", (err, users) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Ошибка получения пользователей' });
    }
    res.json({ users });
  });
});

// Маршрут для получения имени пользователя из сессии
app.get('/username', (req, res) => {
  if (req.session.username) {
    res.json({ username: req.session.username });
  } else {
    res.status(400).json({ error: 'Не авторизован' });
  }
});

app.get('/session-info', (req, res) => {
  if (!req.session.userId) {
    return res.status(403).json({ error: 'Неавторизован' });
  }
  res.json({ userId: req.session.userId, username: req.session.username });
});

app.get('/getChatHistory', (req, res) => {
  const { employeeId, userId } = req.query;

  // Запрашиваем историю сообщений между сотрудником и пользователем
  db.all("SELECT messages.sender, messages.message FROM messages WHERE (userId = ? AND sender != 'employee' AND sender != ?) OR (userId = ? AND sender = 'employee' AND sender != ?) ORDER BY timestamp ASC", [userId, employeeId, employeeId, userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Ошибка при получении истории сообщений' });
    }

    res.json({ success: true, messages: rows });
  });
});

// Socket.io для реального времени
io.on('connection', (socket) => {
  console.log('A user connected: ' + socket.id);

  // Присоединение к комнате по ID пользователя
  socket.on('join', (userId) => {
    console.log('User joined: ' + userId);
    socket.join(userId);
  });

  // Обработка отправки сообщений
  socket.on('sendMessage', (messageData) => {
    const { userId, message, sender } = messageData;

    // Получаем имя пользователя и должность по его ID
    db.get("SELECT username, position, type FROM users WHERE id = ?", [userId], (err, row) => {
      if (err || !row) {
        socket.emit('error', 'Ошибка при отправке сообщения');
        return;
      }

      // Если отправитель сотрудник, то устанавливаем sender как 'employee'
      const actualSender = (sender === 'employee') ? 'employee' : row.username;

      // Сохраняем сообщение в базе данных
      db.run("INSERT INTO messages (userId, sender, message) VALUES (?, ?, ?)", [userId, actualSender, message], function (err) {
        if (err) {
          socket.emit('error', 'Ошибка при отправке сообщения');
          return;
        }

        // Отправляем сообщение всем подключенным клиентам с должностью
        io.emit('message', { sender: actualSender, message, position: row.position });

        // Если отправитель - сотрудник, не отправляем ответ от бота
        if (row.type === 'employee') {
          return;
        }

        // Если сообщение является стандартным запросом, бот отвечает
        let response = '';
        if (message.includes('привет')) {
          response = 'Привет! Как я могу помочь?';
        } else if (message.includes('как дела')) {
          response = 'Спасибо, что спросили! Все хорошо.';
        } else if (message.includes('помощь')) {
          response = 'В чем вам нужна помощь?';
        } else {
          // Если бот не может ответить, создается запрос сотруднику
          db.run("INSERT INTO requests (userId, message, answered, employeeId) VALUES (?, ?, 0, NULL)", [userId, message], function (err) {
            if (err) {
              socket.emit('error', 'Ошибка при создании запроса');
              return;
            }
            // Отправляем уведомление сотрудникам с указанием username
            io.emit('newRequest', { userId, message, username: row.username });
          });
        }

        // Если есть ответ от бота, отправляем его
        if (response) {
          io.emit('message', { sender: 'бот', message: response });
        }
      });
    });
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Запуск сервера
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});