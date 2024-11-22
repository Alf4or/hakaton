document.getElementById('registerFormElement').addEventListener('submit', function(event) {
    event.preventDefault(); // Отменяем стандартное поведение формы

    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    // Отправляем данные на сервер (например, через fetch)
    fetch('http://localhost:3000/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Регистрация успешна!');
            // Перенаправляем на главную страницу после успешной регистрации
            window.location.href = 'index.html';
        } else {
            document.getElementById('error-message').style.display = 'block';
        }
    })
    .catch(error => {
        alert('Ошибка подключения к серверу');
    });
});
