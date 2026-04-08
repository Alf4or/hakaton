/**
 * ============================================
 * 🎨 MODERN UI ENHANCEMENTS & INTERACTIONS
 * ============================================
 */

// ============================================
// 1. THEME TOGGLE (DARK/LIGHT MODE)
// ============================================
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.createToggleButton();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        localStorage.setItem('theme', theme);
        
        // Update toggle button icon
        const toggleBtn = document.querySelector('.theme-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggle() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        
        // Add animation
        document.body.style.transition = 'all 0.3s ease';
        document.body.classList.add('theme-changing');
        setTimeout(() => {
            document.body.classList.remove('theme-changing');
        }, 300);
    }

    createToggleButton() {
        // Check if button already exists
        if (document.querySelector('.theme-toggle')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'theme-toggle';
        toggleBtn.innerHTML = this.currentTheme === 'dark' ? '☀️' : '🌙';
        toggleBtn.onclick = () => this.toggle();
        toggleBtn.title = 'Переключить тему';
        
        document.body.appendChild(toggleBtn);
    }
}

// ============================================
// 2. TOAST NOTIFICATIONS SYSTEM
// ============================================
class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        this.createContainer();
    }

    createContainer() {
        if (document.querySelector('.toast-container')) {
            this.container = document.querySelector('.toast-container');
            return;
        }

        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.container.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                toast.style.animation = 'slideInRight 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }

        return toast;
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }
}

// ============================================
// 3. MODAL MANAGER
// ============================================
class ModalManager {
    constructor() {
        this.activeModal = null;
    }

    create(options = {}) {
        const {
            title = 'Модальное окно',
            content = '',
            showClose = true,
            onClose = null
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.close(overlay, onClose);
        };

        const modal = document.createElement('div');
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                ${showClose ? '<button class="modal-close" onclick="ui.modal.close(this.closest(\'.modal-overlay\'), ' + (onClose ? 'true' : 'false') + ')">×</button>' : ''}
            </div>
            <div class="modal-content">
                ${content}
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Trigger animation
        setTimeout(() => overlay.classList.add('active'), 10);

        this.activeModal = overlay;
        return overlay;
    }

    close(overlay, callback) {
        if (!overlay) overlay = this.activeModal;
        if (!overlay) return;

        overlay.classList.remove('active');
        
        setTimeout(() => {
            overlay.remove();
            this.activeModal = null;
            if (callback) callback();
        }, 300);
    }

    confirm(title, message, onConfirm, onCancel) {
        const modal = this.create({
            title,
            content: `
                <p>${message}</p>
                <div class="flex gap-2 mt-4 justify-between">
                    <button class="btn btn-danger" id="modal-cancel">Отмена</button>
                    <button class="btn btn-success" id="modal-confirm">Подтвердить</button>
                </div>
            `,
            showClose: false
        });

        document.getElementById('modal-confirm').onclick = () => {
            this.close(modal);
            if (onConfirm) onConfirm();
        };

        document.getElementById('modal-cancel').onclick = () => {
            this.close(modal);
            if (onCancel) onCancel();
        };
    }
}

// ============================================
// 4. SCROLL EFFECTS
// ============================================
class ScrollEffects {
    constructor() {
        this.lastScrollY = window.scrollY;
        this.init();
    }

    init() {
        this.handleScroll();
        window.addEventListener('scroll', () => this.handleScroll());
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    handleScroll() {
        const header = document.querySelector('header');
        if (header) {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        // Parallax effect for elements with data-parallax
        document.querySelectorAll('[data-parallax]').forEach(el => {
            const speed = el.dataset.parallax;
            const yPos = -(window.scrollY * speed);
            el.style.transform = `translateY(${yPos}px)`;
        });

        // Fade in elements on scroll
        document.querySelectorAll('[data-fade-in]').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 100) {
                el.classList.add('animate-fadeIn');
            }
        });

        this.lastScrollY = window.scrollY;
    }
}

// ============================================
// 5. FORM ENHANCEMENTS
// ============================================
class FormEnhancer {
    constructor() {
        this.init();
    }

    init() {
        this.enhanceInputs();
        this.addValidation();
        this.addAutoResize();
    }

    enhanceInputs() {
        // Add floating labels
        document.querySelectorAll('.input-group input').forEach(input => {
            const group = input.closest('.input-group');
            if (!group) return;

            const placeholder = input.placeholder;
            input.dataset.placeholder = placeholder;

            input.addEventListener('focus', () => {
                group.classList.add('focused');
            });

            input.addEventListener('blur', () => {
                if (!input.value) {
                    group.classList.remove('focused');
                }
            });

            if (input.value) {
                group.classList.add('has-value');
            }
        });
    }

    addValidation() {
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
                let isValid = true;

                inputs.forEach(input => {
                    if (!input.value.trim()) {
                        isValid = false;
                        this.showError(input, 'Это поле обязательно');
                    } else {
                        this.clearError(input);
                    }
                });

                if (!isValid) {
                    e.preventDefault();
                    ui.toast.error('Пожалуйста, заполните все обязательные поля');
                }
            });
        });
    }

    showError(input, message) {
        this.clearError(input);
        
        input.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'input-error';
        errorDiv.style.cssText = 'color: var(--danger-color); font-size: 0.85em; margin-top: 4px;';
        errorDiv.textContent = message;
        
        input.parentNode.insertBefore(errorDiv, input.nextSibling);
    }

    clearError(input) {
        input.classList.remove('error');
        const errorDiv = input.parentNode.querySelector('.input-error');
        if (errorDiv) errorDiv.remove();
    }

    addAutoResize() {
        document.querySelectorAll('textarea').forEach(textarea => {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        });
    }
}

// ============================================
// 6. LOADING STATES
// ============================================
class LoadingManager {
    static show(element, options = {}) {
        const { text = 'Загрузка...', spinnerSize = 'md' } = options;
        
        element.classList.add('btn-loading');
        element.disabled = true;
        element.dataset.originalText = element.textContent;
        element.textContent = text;
    }

    static hide(element) {
        element.classList.remove('btn-loading');
        element.disabled = false;
        if (element.dataset.originalText) {
            element.textContent = element.dataset.originalText;
        }
    }

    static showPage() {
        const overlay = document.createElement('div');
        overlay.className = 'page-loader';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--bg-primary);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 99999;
        `;
        
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner spinner-lg mb-2"></div>
                <p class="text-secondary">Загрузка...</p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        return overlay;
    }

    static hidePage(loader) {
        if (!loader) loader = document.querySelector('.page-loader');
        if (!loader) return;
        
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => loader.remove(), 300);
    }
}

// ============================================
// 7. UTILITY FUNCTIONS
// ============================================
const UIUtils = {
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Format date
    formatDate(date, options = {}) {
        const defaultOptions = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(date).toLocaleDateString('ru-RU', { ...defaultOptions, ...options });
    },

    // Format number with spaces
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            ui.toast.success('Скопировано в буфер обмена');
            return true;
        } catch (err) {
            ui.toast.error('Не удалось скопировать');
            return false;
        }
    },

    // Generate random ID
    generateId(length = 8) {
        return Math.random().toString(36).substr(2, length);
    },

    // Check if element is in viewport
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

// ============================================
// 8. ANIMATION HELPERS
// ============================================
const AnimationHelper = {
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        element.style.transition = `opacity ${duration}ms ease`;
        
        setTimeout(() => {
            element.style.opacity = '1';
        }, 10);
        
        return new Promise(resolve => {
            setTimeout(resolve, duration);
        });
    },

    fadeOut(element, duration = 300) {
        element.style.opacity = '1';
        element.style.transition = `opacity ${duration}ms ease`;
        
        element.style.opacity = '0';
        
        return new Promise(resolve => {
            setTimeout(() => {
                element.style.display = 'none';
                resolve();
            }, duration);
        });
    },

    slideUp(element, duration = 300) {
        element.style.overflow = 'hidden';
        element.style.transition = `max-height ${duration}ms ease, opacity ${duration}ms ease`;
        element.style.maxHeight = element.scrollHeight + 'px';
        
        setTimeout(() => {
            element.style.maxHeight = '0';
            element.style.opacity = '0';
        }, 10);
        
        return new Promise(resolve => {
            setTimeout(() => {
                element.style.display = 'none';
                resolve();
            }, duration);
        });
    },

    slideDown(element, duration = 300) {
        element.style.overflow = 'hidden';
        element.style.display = 'block';
        element.style.opacity = '0';
        element.style.transition = `max-height ${duration}ms ease, opacity ${duration}ms ease`;
        element.style.maxHeight = '0';
        
        setTimeout(() => {
            element.style.maxHeight = element.scrollHeight + 'px';
            element.style.opacity = '1';
        }, 10);
        
        return new Promise(resolve => {
            setTimeout(() => {
                element.style.maxHeight = 'none';
                resolve();
            }, duration);
        });
    },

    shake(element) {
        element.style.animation = 'shake 0.5s ease';
        return new Promise(resolve => {
            setTimeout(() => {
                element.style.animation = '';
                resolve();
            }, 500);
        });
    }
};

// ============================================
// 9. CHAT ENHANCEMENTS
// ============================================
class ChatEnhancer {
    constructor(chatlogSelector = '#chatlog') {
        this.chatlog = document.querySelector(chatlogSelector);
        this.init();
    }

    init() {
        if (!this.chatlog) return;
        
        // Auto scroll to bottom
        this.scrollToBottom();
    }

    addMessage(text, type = 'bot', options = {}) {
        const { showTimestamp = true, animate = true } = options;
        
        const message = document.createElement('div');
        message.className = `message ${type}`;
        
        const timestamp = showTimestamp ? 
            `<div class="timestamp">${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}</div>` : '';
        
        message.innerHTML = `
            <div class="message-content">${text}</div>
            ${timestamp}
        `;
        
        if (animate) {
            message.style.opacity = '0';
            message.style.transform = 'translateY(20px)';
        }
        
        this.chatlog.appendChild(message);
        
        if (animate) {
            setTimeout(() => {
                message.style.transition = 'all 0.3s ease';
                message.style.opacity = '1';
                message.style.transform = 'translateY(0)';
            }, 10);
        }
        
        this.scrollToBottom();
        return message;
    }

    showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator-msg';
        indicator.innerHTML = `
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        
        this.chatlog.appendChild(indicator);
        this.scrollToBottom();
        
        return indicator;
    }

    hideTypingIndicator(indicator) {
        if (indicator) indicator.remove();
    }

    scrollToBottom() {
        this.chatlog.scrollTop = this.chatlog.scrollHeight;
    }

    clear() {
        this.chatlog.innerHTML = '';
    }
}

// ============================================
// 10. ACCORDION COMPONENT
// ============================================
class Accordion {
    constructor(selector) {
        this.accordion = document.querySelector(selector);
        if (this.accordion) {
            this.init();
        }
    }

    init() {
        const headers = this.accordion.querySelectorAll('.accordion-header');
        
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const item = header.closest('.accordion-item');
                const isActive = item.classList.contains('active');
                
                // Close all items
                this.accordion.querySelectorAll('.accordion-item').forEach(i => {
                    i.classList.remove('active');
                });
                
                // Open clicked item if it wasn't active
                if (!isActive) {
                    item.classList.add('active');
                }
            });
        });
    }
}

// ============================================
// 11. TABS COMPONENT
// ============================================
class Tabs {
    constructor(selector) {
        this.tabsContainer = document.querySelector(selector);
        if (this.tabsContainer) {
            this.init();
        }
    }

    init() {
        const tabs = this.tabsContainer.querySelectorAll('.tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.target;
                
                // Remove active from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Hide all content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show target content
                if (target) {
                    const targetContent = document.querySelector(target);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                }
            });
        });
    }
}

// ============================================
// GLOBAL UI INSTANCE
// ============================================
const ui = {
    theme: null,
    toast: null,
    modal: null,
    scroll: null,
    forms: null,
    
    init() {
        console.log('🎨 Initializing Modern UI Enhancements...');
        
        this.theme = new ThemeManager();
        this.toast = new ToastManager();
        this.modal = new ModalManager();
        this.scroll = new ScrollEffects();
        this.forms = new FormEnhancer();
        
        // Make utilities available globally
        window.uiUtils = UIUtils;
        window.animationHelper = AnimationHelper;
        window.LoadingManager = LoadingManager;
        window.ChatEnhancer = ChatEnhancer;
        window.Accordion = Accordion;
        window.Tabs = Tabs;
        
        console.log('✅ UI Enhancements initialized successfully!');
        
        // Welcome toast
        setTimeout(() => {
            this.toast.info('Добро пожаловать! Система готова к работе', 3000);
        }, 1000);
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ui.init());
} else {
    ui.init();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ui, UIUtils, AnimationHelper };
}
