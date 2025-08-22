// Main Application Controller
class PortalApp {
    constructor() {
        this.currentSection = 'welcome';
        this.initialized = false;
        this.init();
    }

    // Initialize application
    async init() {
        try {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.setup());
            } else {
                this.setup();
            }
        } catch (error) {
            console.error('Error initializing application:', error);
        }
    }

    // Setup application after DOM is ready
    setup() {
        try {
            // Initialize PDF.js worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }

            // Initialize Firebase if not already done
            this.initializeFirebase();

            // Set up event listeners
            this.setupEventListeners();

            // Show welcome section by default
            this.showSection('welcome');

            this.initialized = true;
            console.log('Portal application initialized successfully');

        } catch (error) {
            console.error('Error setting up application:', error);
            this.showErrorMessage('Error al inicializar la aplicación. Por favor, recargue la página.');
        }
    }

    // Initialize Firebase connection
    initializeFirebase() {
        try {
            // Check if Firebase is available and configured
            if (typeof firebase === 'undefined') {
                console.warn('Firebase not loaded');
                return;
            }

            // Test Firebase connection
            const db = window.firebaseDB;
            if (db) {
                console.log('Firebase initialized successfully');
            }

        } catch (error) {
            console.error('Firebase initialization error:', error);
        }
    }

    // Set up global event listeners
    setupEventListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.section) {
                this.showSection(event.state.section, false);
            }
        });

        // Handle form submissions
        document.addEventListener('submit', (event) => {
            event.preventDefault();
        });

        // Handle escape key to close modals
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.hideModals();
            }
        });

        // Handle file drag and drop
        this.setupDragAndDrop();

        // Handle network status
        this.setupNetworkHandlers();
    }

    // Set up drag and drop functionality
    setupDragAndDrop() {
        document.addEventListener('dragover', (event) => {
            event.preventDefault();
        });

        document.addEventListener('drop', (event) => {
            event.preventDefault();
            
            const uploadArea = event.target.closest('.upload-area');
            if (uploadArea) {
                const files = event.dataTransfer.files;
                if (files.length > 0) {
                    const input = uploadArea.querySelector('input[type="file"]');
                    if (input) {
                        // Create a new FileList-like object
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(files[0]);
                        input.files = dataTransfer.files;
                        
                        // Trigger change event
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        });
    }

    // Set up network status handlers
    setupNetworkHandlers() {
        window.addEventListener('online', () => {
            this.hideNetworkError();
        });

        window.addEventListener('offline', () => {
            this.showNetworkError();
        });
    }

    // Show specific section
    showSection(sectionName, addToHistory = true) {
        try {
            // Hide all sections
            const sections = document.querySelectorAll('.section');
            sections.forEach(section => {
                section.classList.remove('active');
            });

            // Show target section
            const targetSection = document.getElementById(`${sectionName}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                this.currentSection = sectionName;

                // Add to browser history
                if (addToHistory) {
                    const title = this.getSectionTitle(sectionName);
                    history.pushState(
                        { section: sectionName }, 
                        title, 
                        `#${sectionName}`
                    );
                    document.title = title;
                }

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Analytics tracking (if available)
                this.trackPageView(sectionName);
            }

        } catch (error) {
            console.error('Error showing section:', error);
        }
    }

    // Get section title
    getSectionTitle(sectionName) {
        const titles = {
            welcome: 'Bienvenido - Portal de Socios Comerciales T&C Group',
            declaration: 'Declaración de Responsabilidad - Portal T&C Group',
            form: 'Registro de Proveedor - Portal T&C Group'
        };
        return titles[sectionName] || 'Portal de Socios Comerciales T&C Group';
    }

    // Show welcome section
    showWelcome() {
        this.showSection('welcome');
    }

    // Show declaration section
    showDeclaration() {
        this.showSection('declaration');
    }

    // Show form section
    showForm() {
        // Validate declaration acceptance
        const checkbox = document.getElementById('accept-declaration');
        if (!checkbox || !checkbox.checked) {
            this.showErrorMessage('Debe aceptar la Declaración de Responsabilidad para continuar.');
            return;
        }

        this.showSection('form');
    }

    // Show error message
    showErrorMessage(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add styles if not exist
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10000;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease-out;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .notification-content button {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(errorDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // Show success message
    showSuccessMessage(message) {
        // Similar to error message but with success styling
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add success styles if not exist
        if (!document.getElementById('success-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'success-notification-styles';
            styles.textContent = `
                .success-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10000;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease-out;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(successDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 5000);
    }

    // Show network error
    showNetworkError() {
        const networkError = document.createElement('div');
        networkError.id = 'network-error';
        networkError.innerHTML = `
            <div class="network-error-content">
                <i class="fas fa-wifi"></i>
                <span>Sin conexión a internet. Algunas funciones pueden no estar disponibles.</span>
            </div>
        `;

        // Add network error styles
        if (!document.getElementById('network-error-styles')) {
            const styles = document.createElement('style');
            styles.id = 'network-error-styles';
            styles.textContent = `
                #network-error {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #f59e0b;
                    color: white;
                    padding: 0.5rem;
                    text-align: center;
                    z-index: 10001;
                    font-weight: 500;
                }
                .network-error-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(networkError);
    }

    // Hide network error
    hideNetworkError() {
        const networkError = document.getElementById('network-error');
        if (networkError) {
            networkError.remove();
        }
    }

    // Hide modals
    hideModals() {
        const modals = document.querySelectorAll('.modal, .loading-overlay');
        modals.forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Track page view (for analytics)
    trackPageView(sectionName) {
        // Google Analytics tracking (if available)
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                page_title: this.getSectionTitle(sectionName),
                page_location: window.location.href
            });
        }

        // Custom analytics tracking can be added here
        console.log(`Page view: ${sectionName}`);
    }

    // Utility method to format dates
    formatDate(date) {
        if (!date) return '';
        
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Mexico_City'
        };
        
        return new Intl.DateTimeFormat('es-MX', options).format(date);
    }

    // Utility method to format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get application status
    getStatus() {
        return {
            initialized: this.initialized,
            currentSection: this.currentSection,
            firebaseConnected: typeof window.firebaseDB !== 'undefined',
            ocrReady: typeof window.ocrProcessor !== 'undefined',
            formHandlerReady: typeof window.formHandler !== 'undefined'
        };
    }
}

// ========================================
// GLOBAL FUNCTIONS FOR HTML EVENTS
// ========================================

// Main navigation functions
window.showWelcome = () => window.portalApp.showWelcome();
window.showDeclaration = () => window.portalApp.showDeclaration();
window.showForm = () => window.portalApp.showForm();

// Form navigation functions - Updated for 3 steps
window.triggerFileUpload = (type) => window.formHandler.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler.handleFileUpload(type, input);
window.showCompanyInfo = () => window.formHandler.showCompanyInfo();
window.showBankingInfo = () => window.formHandler.showBankingInfo();
window.showDocuments = () => window.formHandler.showDocuments();
window.submitForm = () => window.formHandler.submitForm();

// Helper function for step validation
window.validateCurrentStep = () => {
    if (!window.formHandler) {
        return false;
    }
    
    const currentStep = window.formHandler.currentStep;
    
    switch (currentStep) {
        case 'documents':
            return window.formHandler.validationStatus.opinion && 
                   window.formHandler.validationStatus.constancia && 
                   window.formHandler.validationStatus.bancario;
        case 'company':
            const nombreComercial = document.getElementById('nombre-comercial');
            return nombreComercial && nombreComercial.value && nombreComercial.value.trim().length > 0;
        case 'banking':
            return window.formHandler.validationStatus.banking;
        default:
            return false;
    }
};

// Debug helper functions
window.getAppStatus = () => {
    return {
        portalApp: window.portalApp ? window.portalApp.getStatus() : 'Not initialized',
        formHandler: window.formHandler ? 'Ready' : 'Not ready',
        ocrProcessor: window.ocrProcessor ? 'Ready' : 'Not ready',
        currentStep: window.formHandler ? window.formHandler.currentStep : 'Unknown'
    };
};

// Form step navigation helpers
window.canProceedToNextStep = () => {
    return window.validateCurrentStep();
};

window.getCurrentFormStep = () => {
    return window.formHandler ? window.formHandler.currentStep : null;
};

// ========================================
// APPLICATION INITIALIZATION
// ========================================

// Initialize application when script loads
window.portalApp = new PortalApp();

// Expose app for debugging
window.PortalApp = PortalApp;

// Service Worker registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.portalApp) {
        window.portalApp.showErrorMessage('Ha ocurrido un error inesperado. Por favor, recargue la página.');
    }
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.portalApp) {
        window.portalApp.showErrorMessage('Error en el procesamiento. Por favor, intente nuevamente.');
    }
});