/**
 * Централизованная валидация данных
 * Заменяет ручные проверки во всех маршрутах
 */

const validator = {
    // ============================================
    // БАЗОВЫЕ ВАЛИДАТОРЫ
    // ============================================
    
    /**
     * Проверка на пустое значение
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },

    /**
     * Проверка строки
     */
    isString(value, options = {}) {
        const { minLength = 0, maxLength = Infinity, pattern = null, required = false } = options;
        
        if (required && this.isEmpty(value)) {
            return { valid: false, error: 'Поле обязательно для заполнения' };
        }
        
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: '' };
        }
        
        if (typeof value !== 'string') {
            return { valid: false, error: 'Должно быть строкой' };
        }
        
        const trimmed = value.trim();
        
        if (trimmed.length < minLength) {
            return { valid: false, error: `Минимальная длина: ${minLength} символов` };
        }
        
        if (trimmed.length > maxLength) {
            return { valid: false, error: `Максимальная длина: ${maxLength} символов` };
        }
        
        if (pattern && !pattern.test(trimmed)) {
            return { valid: false, error: 'Неверный формат' };
        }
        
        return { valid: true, value: trimmed };
    },

    /**
     * Проверка email
     */
    isEmail(value, required = true) {
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: '' };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'Email обязателен' };
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!emailRegex.test(value)) {
            return { valid: false, error: 'Неверный формат email' };
        }
        
        if (value.length > 254) {
            return { valid: false, error: 'Email слишком длинный' };
        }
        
        return { valid: true, value: value.toLowerCase().trim() };
    },

    /**
     * Проверка пароля
     */
    isPassword(value, options = {}) {
        const { 
            minLength = 8, 
            requireUppercase = true, 
            requireLowercase = true, 
            requireNumber = true, 
            requireSpecial = true 
        } = options;
        
        if (this.isEmpty(value)) {
            return { valid: false, error: 'Пароль обязателен' };
        }
        
        const errors = [];
        
        if (value.length < minLength) {
            errors.push(`Минимум ${minLength} символов`);
        }
        
        if (requireUppercase && !/[A-Z]/.test(value)) {
            errors.push('Хотя бы одна заглавная буква');
        }
        
        if (requireLowercase && !/[a-z]/.test(value)) {
            errors.push('Хотя бы одна строчная буква');
        }
        
        if (requireNumber && !/[0-9]/.test(value)) {
            errors.push('Хотя бы одна цифра');
        }
        
        if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
            errors.push('Хотя бы один специальный символ');
        }
        
        if (errors.length > 0) {
            return { valid: false, error: errors.join(', ') };
        }
        
        return { valid: true, value };
    },

    /**
     * Проверка числа
     */
    isNumber(value, options = {}) {
        const { min = -Infinity, max = Infinity, integer = false, required = false } = options;
        
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: null };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'Число обязательно' };
        }
        
        const num = Number(value);
        
        if (isNaN(num)) {
            return { valid: false, error: 'Должно быть числом' };
        }
        
        if (integer && !Number.isInteger(num)) {
            return { valid: false, error: 'Должно быть целым числом' };
        }
        
        if (num < min || num > max) {
            return { valid: false, error: `Должно быть от ${min} до ${max}` };
        }
        
        return { valid: true, value: num };
    },

    /**
     * Проверка даты
     */
    isDate(value, options = {}) {
        const { past = true, future = true, required = false } = options;
        
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: null };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'Дата обязательна' };
        }
        
        const date = new Date(value);
        
        if (isNaN(date.getTime())) {
            return { valid: false, error: 'Неверный формат даты' };
        }
        
        const now = new Date();
        
        if (!past && date < now) {
            return { valid: false, error: 'Дата должна быть в будущем' };
        }
        
        if (!future && date > now) {
            return { valid: false, error: 'Дата должна быть в прошлом' };
        }
        
        return { valid: true, value: date.toISOString() };
    },

    /**
     * Проверка массива
     */
    isArray(value, options = {}) {
        const { minLength = 0, maxLength = Infinity, itemType = null, required = false } = options;
        
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: [] };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'Массив обязателен' };
        }
        
        if (!Array.isArray(value)) {
            return { valid: false, error: 'Должно быть массивом' };
        }
        
        if (value.length < minLength || value.length > maxLength) {
            return { valid: false, error: `Длина массива должна быть от ${minLength} до ${maxLength}` };
        }
        
        if (itemType) {
            for (const item of value) {
                if (typeof item !== itemType) {
                    return { valid: false, error: `Все элементы должны быть типа ${itemType}` };
                }
            }
        }
        
        return { valid: true, value };
    },

    /**
     * Проверка enum (список допустимых значений)
     */
    isEnum(value, allowedValues, required = true) {
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: null };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'Значение обязательно' };
        }
        
        if (!allowedValues.includes(value)) {
            return { valid: false, error: `Допустимые значения: ${allowedValues.join(', ')}` };
        }
        
        return { valid: true, value };
    },

    /**
     * Проверка username
     */
    isUsername(value, required = true) {
        return this.isString(value, {
            minLength: 3,
            maxLength: 30,
            pattern: /^[a-zA-Z0-9_-]+$/,
            required
        });
    },

    /**
     * Проверка телефона
     */
    isPhone(value, required = false) {
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: '' };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'Телефон обязателен' };
        }
        
        const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
        
        if (!phoneRegex.test(value.replace(/\s/g, ''))) {
            return { valid: false, error: 'Неверный формат телефона' };
        }
        
        return { valid: true, value: value.replace(/\D/g, '') };
    },

    /**
     * Проверка URL
     */
    isUrl(value, required = false) {
        if (this.isEmpty(value) && !required) {
            return { valid: true, value: '' };
        }
        
        if (this.isEmpty(value) && required) {
            return { valid: false, error: 'URL обязателен' };
        }
        
        try {
            new URL(value);
            return { valid: true, value };
        } catch {
            return { valid: false, error: 'Неверный формат URL' };
        }
    },

    // ============================================
    // КОМПОЗИТОР ВАЛИДАЦИИ
    // ============================================
    
    /**
     * Валидация объекта по схеме
     */
    validate(data, schema) {
        const errors = {};
        const validated = {};
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            let result;
            
            switch (rules.type) {
                case 'string':
                    result = this.isString(value, rules.options || {});
                    break;
                case 'email':
                    result = this.isEmail(value, rules.required);
                    break;
                case 'password':
                    result = this.isPassword(value, rules.options || {});
                    break;
                case 'number':
                    result = this.isNumber(value, rules.options || {});
                    break;
                case 'date':
                    result = this.isDate(value, rules.options || {});
                    break;
                case 'array':
                    result = this.isArray(value, rules.options || {});
                    break;
                case 'enum':
                    result = this.isEnum(value, rules.allowedValues, rules.required);
                    break;
                case 'username':
                    result = this.isUsername(value, rules.required);
                    break;
                case 'phone':
                    result = this.isPhone(value, rules.required);
                    break;
                case 'url':
                    result = this.isUrl(value, rules.required);
                    break;
                default:
                    result = { valid: true, value };
            }
            
            if (!result.valid) {
                errors[field] = result.error;
            } else {
                validated[field] = result.value;
            }
        }
        
        return {
            valid: Object.keys(errors).length === 0,
            errors: Object.keys(errors).length > 0 ? errors : null,
            data: validated
        };
    },
};

module.exports = validator;
