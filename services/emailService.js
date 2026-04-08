/**
 * Сервис отправки email уведомлений
 * Поддержка SMTP, шаблонов писем, очередей
 */

const config = require('../config');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        this.transporter = null;
        this.queue = [];
        this.isProcessing = false;
        this.initialized = false;
    }

    async initialize() {
        if (!config.email.enabled) {
            logger.info('Email service disabled');
            return;
        }

        try {
            // Динамический импорт nodemailer
            const nodemailer = (await import('nodemailer')).default;
            
            this.transporter = nodemailer.createTransport({
                host: config.email.host,
                port: config.email.port,
                secure: config.email.port === 465,
                auth: {
                    user: config.email.user,
                    pass: config.email.pass,
                },
            });

            // Проверка соединения
            await this.transporter.verify();
            this.initialized = true;
            logger.info('Email service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize email service', { error: error.message });
            this.initialized = false;
        }
    }

    /**
     * Отправка email с использованием шаблона
     */
    async send(options) {
        const { to, subject, template, data = {}, html, text, attachments = [] } = options;

        if (!this.initialized) {
            logger.warn('Email service not initialized, queuing message', { to, subject });
            this.queue.push(options);
            return { queued: true };
        }

        try {
            let content = html || text;
            
            // Применение шаблона если указан
            if (template && !html) {
                content = this.renderTemplate(template, data);
            }

            const mailOptions = {
                from: config.email.from,
                to: Array.isArray(to) ? to.join(', ') : to,
                subject: this.interpolate(subject, data),
                html: content,
                text: text || this.stripHtml(content),
                attachments,
            };

            const result = await this.transporter.sendMail(mailOptions);
            
            logger.info('Email sent successfully', { to, subject, messageId: result.messageId });
            
            return { success: true, messageId: result.messageId };
        } catch (error) {
            logger.error('Failed to send email', { to, subject, error: error.message });
            throw error;
        }
    }

    /**
     * Рендеринг HTML шаблона
     */
    renderTemplate(templateName, data) {
        const templates = {
            welcome: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333;">Добро пожаловать, {{username}}!</h1>
                    <p>Спасибо за регистрацию в нашей системе.</p>
                    <p>Ваш аккаунт был успешно создан.</p>
                    <a href="{{loginUrl}}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Войти</a>
                </div>
            `,
            passwordReset: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333;">Сброс пароля</h1>
                    <p>Вы запросили сброс пароля для вашего аккаунта.</p>
                    <p>Нажмите на кнопку ниже чтобы установить новый пароль:</p>
                    <a href="{{resetUrl}}" style="display: inline-block; padding: 10px 20px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px;">Сбросить пароль</a>
                    <p>Если вы не запрашивали сброс, проигнорируйте это письмо.</p>
                </div>
            `,
            ticketResponse: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333;">Ответ на тикет #{{ticketId}}</h1>
                    <p><strong>Тема:</strong> {{subject}}</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        {{message}}
                    </div>
                    <a href="{{ticketUrl}}" style="display: inline-block; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Посмотреть тикет</a>
                </div>
            `,
            notification: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333;">{{title}}</h1>
                    <p>{{message}}</p>
                </div>
            `,
        };

        const template = templates[templateName];
        if (!template) {
            throw new Error(`Template "${templateName}" not found`);
        }

        return this.interpolate(template, data);
    }

    /**
     * Интерполяция переменных в шаблоне
     */
    interpolate(template, data) {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    /**
     * Удаление HTML тегов
     */
    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Обработка очереди писем
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const options = this.queue.shift();
            try {
                await this.send(options);
            } catch (error) {
                logger.error('Failed to send queued email', { error: error.message });
            }
        }

        this.isProcessing = false;
    }

    // ============================================
    // ПРЕОПРЕДЕЛЕННЫЕ МЕТОДЫ ОТПРАВКИ
    // ============================================

    async sendWelcomeEmail(user) {
        return this.send({
            to: user.email,
            subject: 'Добро пожаловать в систему поддержки!',
            template: 'welcome',
            data: {
                username: user.username,
                loginUrl: `${config.cors.origin}/login`,
            },
        });
    }

    async sendPasswordReset(user, resetToken) {
        return this.send({
            to: user.email,
            subject: 'Сброс пароля',
            template: 'passwordReset',
            data: {
                username: user.username,
                resetUrl: `${config.cors.origin}/reset-password?token=${resetToken}`,
            },
        });
    }

    async sendTicketResponse(user, ticket, response) {
        return this.send({
            to: user.email,
            subject: `Ответ на тикет #${ticket.id}`,
            template: 'ticketResponse',
            data: {
                ticketId: ticket.id,
                subject: ticket.subject,
                message: response.message,
                ticketUrl: `${config.cors.origin}/tickets/${ticket.id}`,
            },
        });
    }

    async sendNotification(user, title, message) {
        return this.send({
            to: user.email,
            subject: title,
            template: 'notification',
            data: { title, message },
        });
    }
}

// Singleton
const emailService = new EmailService();

module.exports = emailService;
module.exports.EmailService = EmailService;
