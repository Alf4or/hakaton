const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Middleware для обработки JSON
app.use(bodyParser.json());
app.use(express.static('public')); // Для статичных файлов (HTML, CSS, JS)

// Чтение данных из файла FAQ (асинхронное)
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

// Эндпоинт для получения FAQ
app.get('/faq', async (req, res) => {
    try {
        const faqData = await readFAQFile();
        res.json(faqData);
    } catch (error) {
        res.status(500).json({ error: 'Не удалось загрузить FAQ' });
    }
});

// Обработчик для чата (поиск ответа на сообщение)
app.post('/chat', async (req, res) => {
    const userMessage = req.body.message.toLowerCase();
    try {
        const faqData = await readFAQFile();
        let responseMessage = "Извините, я не понимаю.";

        // Поиск ответа на вопрос в FAQ
        for (const entry of faqData) {
            if (userMessage.includes(entry.question.toLowerCase())) {
                responseMessage = entry.answer;
                break;
            }
        }

        res.json({ response: responseMessage });
    } catch (error) {
        res.status(500).json({ response: "Произошла ошибка при обработке вашего запроса." });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Сервер работает на http://localhost:${port}`);
});
