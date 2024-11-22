// Инициализация переменных
const messageInput = document.getElementById("userMessage");
const sendButton = document.getElementById("sendBtn");
const chatLog = document.getElementById("chatlog");

// Функция для отображения сообщения в чате
function displayMessage(sender, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add(sender);
    messageElement.textContent = message;
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight; // Автопрокрутка к последнему сообщению
}

// Обработчик события отправки сообщения
sendButton.addEventListener("click", async (event) => {
    event.preventDefault(); // предотвращаем отправку формы
    const userMessage = messageInput.value;
    if (userMessage.trim() !== "") {
        displayMessage("user", `Вы: ${userMessage}`);
        const botResponse = await getBotResponse(userMessage);
        displayMessage("bot", `Бот Евгений: ${botResponse}`);
        messageInput.value = ""; // Очистка поля ввода
    }
});

// Функция для получения ответа от FAQ (или сервера)
async function getBotResponse(userMessage) {
    userMessage = userMessage.toLowerCase();
    let responseMessage = "Я не знаю ответ на ваш вопрос. Попробуйте выбрать тему из списка или обратитесь позже.";
    
    try {
        // Запрос к файлу FAQ (faq.json)
        const response = await fetch('js/faq.json');
        if (!response.ok) {
            const message = `HTTP error! status: ${response.status}`;
            console.error(message);
            throw new Error(message);
        }

        const faq = await response.json();

        // Поиск ответа в FAQ
        for (const entry of faq) {
            if (userMessage.includes(entry.question.toLowerCase())) {
                responseMessage = entry.answer;
                break;
            }
        }

        // Если ответ не найден, сохранить вопрос
        if (responseMessage === "Я не знаю ответ на ваш вопрос. Попробуйте выбрать тему из списка или обратитесь позже.") {
            await saveUnansweredQuestion(userMessage);
        }
    } catch (error) {
        console.error("Ошибка при загрузке или обработке faq.json:", error);
        responseMessage = "Произошла ошибка. Попробуйте позже.";
    }

    return responseMessage; // Возвращаем найденный ответ
}

// Функция для сохранения вопросов без ответов
async function saveUnansweredQuestion(question) {
    try {
        await fetch('/save-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        console.log("Вопрос успешно сохранён:", question);
    } catch (err) {
        console.error("Ошибка при сохранении вопроса:", err);
    }
}