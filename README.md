# ASD - Система управления заявками и задачами

Веб-приложение для управления заявками (тикетами), задачами, пользователями и другими аспектами организации.

## 📋 Описание

Проект представляет собой полноценную систему управления с поддержкой:
- Аутентификации и авторизации пользователей
- Ролевой модели (администратор, сотрудник, пользователь)
- Управления заявками (тикетами)
- Управления задачами
- Системы уведомлений (real-time через Socket.IO)
- Базы знаний (FAQ)
- Настроек системы
- Генерации отчетов
- Полнотекстового поиска
- Email-уведомлений
- Логирования событий

## 🚀 Технологии

- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, JavaScript, EJS
- **База данных**: SQLite3
- **Аутентификация**: bcrypt, express-session
- **Real-time**: Socket.IO
- **Email**: Nodemailer (опционально)
- **Безопасность**: CORS, CSRF protection, Rate limiting, Хеширование паролей

## 📦 Установка

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Установите зависимости:
```bash
npm install
```

3. Настройте переменные окружения (опционально):
```bash
cp .env.example .env
# Отредактируйте .env под ваши нужды
```

4. Запустите сервер:
```bash
npm start
```

Сервер будет доступен по адресу: `http://localhost:3000`

## ⚙️ Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `NODE_ENV` | Режим работы (production/development) | `development` |
| `PORT` | Порт сервера | `3000` |
| `HOST` | Хост сервера | `localhost` |
| `SESSION_SECRET` | Секретный ключ для сессий | `fallback_secret_change_in_production` |
| `JWT_SECRET` | Секретный ключ для JWT | `fallback_jwt_secret` |
| `DB_PATH` | Путь к базе данных SQLite | `./database.db` |
| `SMTP_HOST` | SMTP сервер для email | - |
| `SMTP_PORT` | SMTP порт | `587` |
| `SMTP_USER` | SMTP пользователь | - |
| `SMTP_PASS` | SMTP пароль | - |
| `EMAIL_FROM` | Адрес отправителя email | `noreply@system.com` |
| `REDIS_HOST` | Redis хост (опционально) | `localhost` |
| `REDIS_PORT` | Redis порт | `6379` |
| `LOG_LEVEL` | Уровень логирования | `info` |
| `LOG_FILE` | Путь к файлу логов | `./logs/app.log` |
| `CORS_ORIGIN` | Разрешённый CORS origin | `http://localhost:3000` |

## 🏗️ Структура проекта

```
├── config/                 # Конфигурация приложения
│   └── index.js           # Централизованные настройки
├── css/                    # Стили приложения
├── html/                   # HTML-шаблоны и страницы
├── js/                     # Клиентский JavaScript
├── middleware/             # Промежуточное ПО (auth, rate limiting, CSRF)
├── models/                 # Модели данных
│   └── User.js            # Модель пользователя
├── routes/                 # API маршруты
│   ├── admin.js           # Администрирование
│   ├── auth.js            # Аутентификация
│   ├── faq.js             # База знаний
│   ├── index.js           # Маршрутизатор
│   ├── notifications.js   # Уведомления
│   ├── reports.js         # Отчёты и статистика
│   ├── search.js          # Поиск по системе
│   ├── settings.js        # Настройки
│   ├── tasks.js           # Задачи
│   └── tickets.js         # Заявки
├── services/               # Сервисы
│   ├── emailService.js    # Email-уведомления
│   ├── index.js           # Экспорт сервисов
│   └── socketService.js   # Socket.IO сервис
├── utils/                  # Утилиты
│   ├── database.js        # Инициализация и работа с БД
│   ├── logger.js          # Логирование
│   └── validators.js      # Валидация данных
├── server.js              # Главный файл сервера
├── package.json           # Зависимости проекта
└── database.db            # SQLite база данных
```

## 🔌 API Endpoints

Все API endpoints доступны с префиксом `/api/v1` (настраивается в конфиге).

### Аутентификация (`/api/auth/*`)
- `POST /register` - Регистрация нового пользователя
- `POST /login` - Вход в систему
- `POST /logout` - Выход из системы
- `GET /me` - Получение данных текущего пользователя

### Администрирование (`/api/admin/*`)
- `GET /users` - Список всех пользователей
- `PUT /users/:id/promote` - Повышение роли пользователя
- `DELETE /users/:id` - Удаление пользователя
- `GET /stats` - Статистика системы

### Заявки (`/api/tickets/*`)
- `GET /tickets` - Список заявок (с пагинацией и фильтрами)
- `POST /tickets` - Создание новой заявки
- `GET /tickets/:id` - Получение заявки по ID
- `PUT /tickets/:id` - Обновление заявки
- `DELETE /tickets/:id` - Удаление заявки
- `POST /tickets/:id/comments` - Добавление комментария

### Задачи (`/api/tasks/*`)
- `GET /tasks` - Список задач
- `POST /tasks` - Создание задачи
- `PUT /tasks/:id` - Обновление задачи
- `DELETE /tasks/:id` - Удаление задачи

### Уведомления (`/api/notifications/*`)
- `GET /notifications` - Список уведомлений пользователя
- `PUT /notifications/:id/read` - Отметка уведомления как прочитанное
- `DELETE /notifications/:id` - Удаление уведомления

### FAQ (`/api/faq/*`)
- `GET /faq` - Список статей базы знаний
- `POST /faq` - Создание статьи (admin)
- `PUT /faq/:id` - Обновление статьи (admin)
- `DELETE /faq/:id` - Удаление статьи (admin)

### Настройки (`/api/settings/*`)
- `GET /settings` - Получение настроек системы
- `PUT /settings` - Обновление настроек (admin)

### Отчёты (`/api/reports/*`)
- `GET /reports/tickets` - Отчёт по заявкам
- `GET /reports/tasks` - Отчёт по задачам
- `GET /reports/users` - Отчёт по пользователям

### Поиск (`/api/search/*`)
- `GET /search` - Полнотекстовый поиск по системе

### Системные endpoints
- `GET /health` - Проверка здоровья сервера
- `GET /status` - Подробный статус системы

## 🔐 Роли пользователей

- **admin** - Полный доступ ко всем функциям системы, управление пользователями, настройками, отчётами
- **employee** - Доступ к панели сотрудника, управление задачами, работа с заявками
- **user** - Базовый доступ, создание и просмотр своих заявок

## 🛡️ Безопасность

- Rate limiting для защиты от brute-force атак
- CSRF токены для защиты от межсайтовой подделки запросов
- Хеширование паролей с помощью bcrypt (12 раундов)
- HTTP-only cookies для сессий
- CORS политика
- Защита от lockout после неудачных попыток входа
- Валидация входных данных

## 📝 Лицензия

ISC

## 👥 Авторы

Разработано командой ASD
