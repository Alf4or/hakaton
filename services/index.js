/**
 * Централизованный экспорт всех сервисов
 */

const emailService = require('./emailService');
const socketService = require('./socketService');

module.exports = {
    emailService,
    socketService,
};
