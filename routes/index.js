/**
 * Централизованный экспорт всех маршрутов
 */

const authRoutes = require('./auth');
const ticketsRoutes = require('./tickets');
const tasksRoutes = require('./tasks');
const adminRoutes = require('./admin');
const notificationsRoutes = require('./notifications');
const faqRoutes = require('./faq');
const settingsRoutes = require('./settings');
const reportsRoutes = require('./reports');
const searchRoutes = require('./search');

module.exports = {
    auth: authRoutes,
    tickets: ticketsRoutes,
    tasks: tasksRoutes,
    admin: adminRoutes,
    notifications: notificationsRoutes,
    faq: faqRoutes,
    settings: settingsRoutes,
    reports: reportsRoutes,
    search: searchRoutes,
};
