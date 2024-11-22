document.addEventListener('DOMContentLoaded', function() {
    const taskForm = document.getElementById('taskForm');
    const taskDescriptionInput = document.getElementById('taskDescription');
    const taskPrioritySelect = document.getElementById('taskPriority');
    const urgentTaskList = document.getElementById('urgentTaskList');
    const importantTaskList = document.getElementById('importantTaskList');

    // Функция для добавления задачи
    taskForm.addEventListener('submit', function(event) {
        event.preventDefault();  // Отменяем стандартное поведение формы

        const taskDescription = taskDescriptionInput.value.trim();
        const taskPriority = taskPrioritySelect.value;

        if (taskDescription !== "") {
            // Создаем элемент списка для задачи
            const taskItem = document.createElement('li');
            taskItem.textContent = taskDescription;

            // В зависимости от приоритета добавляем задачу в соответствующий список
            if (taskPriority === 'urgent') {
                urgentTaskList.appendChild(taskItem);
            } else if (taskPriority === 'important') {
                importantTaskList.appendChild(taskItem);
            }

            // Очищаем поле ввода
            taskDescriptionInput.value = '';
        }
    });
});
