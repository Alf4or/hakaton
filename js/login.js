document.getElementById('loginFormElement').addEventListener('submit', function(event) {
    event.preventDefault(); // Отменяем стандартное поведение формы

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    fetch('http://localhost:3000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Сохраняем информацию о пользователе в localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            // Перенаправляем на главную страницу
            window.location.href = 'index.html';
        } else {
            document.getElementById('error-message').style.display = 'block';
        }
    })
    .catch(error => {
        alert('Ошибка подключения к серверу');
    });
});
