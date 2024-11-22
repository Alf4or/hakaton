// РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ РїРµСЂРµРјРµРЅРЅС‹С…
const messageInput = document.getElementById("userMessage");
const sendButton = document.getElementById("sendBtn");
const chatLog = document.getElementById("chatlog");
const topicsList = document.getElementById("topicsList"); // Этот элемент не используется в коде

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РІС‹РІРѕРґР° СЃРѕРѕР±С‰РµРЅРёСЏ РІ С‡Р°С‚
function displayMessage(sender, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add(sender);
    messageElement.textContent = message;
    chatLog.appendChild(messageElement);
    chatLog.scrollTop = chatLog.scrollHeight;
}

// РћР±СЂР°Р±РѕС‚С‡РёРє СЃРѕР±С‹С‚РёР№ РґР»СЏ РѕС‚РїСЂР°РІРєРё СЃРѕРѕР±С‰РµРЅРёСЏ
sendButton.addEventListener("click", async () => { // <-- Добавлено async
    const userMessage = messageInput.value;
    if (userMessage.trim() !== "") {
        displayMessage("user", userMessage);
        const botResponse = await getBotResponse(userMessage); // <-- await здесь
        displayMessage("bot", botResponse);
        messageInput.value = "";
    }
});

// Р¤СѓРЅРєС†РёСЏ РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РѕС‚РІРµС‚Р° РѕС‚ СЃРµСЂРІРµСЂР° (FAQ РёР»Рё GPT)
async function getBotResponse(userMessage) { // <-- Добавлено async
    userMessage = userMessage.toLowerCase();
    let responseMessage = "Я не знаю ответ на ваш вопрос, перейдите в раздел тем который похож на ваш вопрос.";

    try {
        const response = await fetch('faq.json');

        if (!response.ok) {
            const message = `HTTP error! status: ${response.status}`;
            console.error(message);
            throw new Error(message);
        }

        const faq = await response.json();

        for (const entry of faq) {
            if (userMessage.includes(entry.question.toLowerCase())) {
                responseMessage = entry.answer;
                break;
            }
        }
    } catch (error) {
        console.error("Ошибка при загрузке или обработке faq.json:", error);
        responseMessage = "Произошла ошибка. Попробуйте позже.";
    }

    return responseMessage; // Возвращаем сообщение
}
