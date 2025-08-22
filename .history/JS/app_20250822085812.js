// Main Application Controller
class PortalApp {
    constructor() {
        this.currentSection = 'welcome';
        this.initialized = false;
        this.firebaseReady = false;
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

            // Inicializar progreso correcto después de que todo esté listo
            setTimeout(() => {
                if (window.formHandler) {
                    window.formHandler.updateProgress(20, 'Paso 1 de 5: Documentos');
                }
            }, 100);

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
                console.warn('Firebase SDK not loaded');
                return;
            }

            // Wait longer for Firebase to initialize
            setTimeout(() => {
                if (window.firebaseLoaded && window.firebaseDB) {
                    console.log('Firebase connection verified');
                    this.firebaseReady = true;
                } else {
                    console.warn('Firebase services not ready, will retry...');
                    this.firebaseReady = false;
                    // Retry after another delay
                    setTimeout(() => {
                        if (window.firebaseLoaded && window.firebaseDB) {
                            console.log('Firebase connection verified on retry');
                            this.firebaseReady = true;
                        } else {
                            console.error('Firebase failed to initialize after retries');
                        }
                    }, 2000);
                }
            }, 500); // Increased delay

        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.firebaseReady = false;
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

        // Setup declaration checkbox handler
        this.setupDeclarationHandler();
    }

    // Setup declaration checkbox handler
    setupDeclarationHandler() {
        // Wait for DOM to be ready before setting up checkbox handler
        setTimeout(() => {
            const checkbox = document.getElementById('accept-declaration');
            const continueBtn = document.getElementById('continue-btn');
            
            if (checkbox && continueBtn) {
                checkbox.addEventListener('change', (event) => {
                    continueBtn.disabled = !event.target.checked;
                });
            }
        }, 100);
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

                // Setup section-specific handlers
                this.setupSectionHandlers(sectionName);
            }

        } catch (error) {
            console.error('Error showing section:', error);
        }
    }

    // Setup section-specific handlers
    setupSectionHandlers(sectionName) {
        if (sectionName === 'declaration') {
            // Re-setup declaration checkbox handler when showing declaration section
            setTimeout(() => this.setupDeclarationHandler(), 50);
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
        // Remove existing error notifications
        const existingErrors = document.querySelectorAll('.error-notification');
        existingErrors.forEach(error => error.remove());

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
                    border-radius: 4px;
                }
                .notification-content button:hover {
                    background: rgba(255, 255, 255, 0.1);
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
        // Remove existing success notifications
        const existingSuccess = document.querySelectorAll('.success-notification');
        existingSuccess.forEach(success => success.remove());

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
                .success-notification .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .success-notification .notification-content button {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                    border-radius: 4px;
                }
                .success-notification .notification-content button:hover {
                    background: rgba(255, 255, 255, 0.1);
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
        // Remove existing network error
        this.hideNetworkError();

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
                    animation: slideInDown 0.3s ease-out;
                }
                .network-error-content {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                }
                @keyframes slideInDown {
                    from {
                        transform: translateY(-100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
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
            firebaseReady: this.firebaseReady,
            firebaseConnected: typeof window.firebaseDB !== 'undefined' && window.firebaseLoaded,
            ocrReady: typeof window.ocrProcessor !== 'undefined',
            formHandlerReady: typeof window.formHandler !== 'undefined'
        };
    }
}

// ========================================
// GLOBAL FUNCTIONS FOR HTML EVENTS
// ========================================

// Main navigation functions
window.showWelcome = () => window.portalApp?.showWelcome();
window.showDeclaration = () => window.portalApp?.showDeclaration();
window.showForm = () => window.portalApp?.showForm();

// File handling functions
window.triggerFileUpload = (type) => window.formHandler?.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler?.handleFileUpload(type, input);

// Step navigation functions
window.showCompanyInfo = () => window.formHandler?.showCompanyInfo();
window.showBankingInfo = () => window.formHandler?.showBankingInfo();
window.showContactInfo = () => window.formHandler?.showContactInfo();
window.showCommercialConditions = () => window.formHandler?.showCommercialConditions();
window.showDocuments = () => window.formHandler?.showDocuments();
window.submitForm = () => window.formHandler?.submitForm();

// Contact step functions - FIXED: Properly defined global functions with better error handling
window.proceedToCommercialConditions = function() {
    console.log('proceedToCommercialConditions called');
    try {
        // Wait for handlers to be ready
        if (!window.contactStepHandler) {
            console.warn('contactStepHandler not ready yet');
            setTimeout(() => window.proceedToCommercialConditions(), 100);
            return;
        }
        
        if (!window.contactStepHandler.validateAllContactFields()) {
            if (window.portalApp) {
                window.portalApp.showErrorMessage('Por favor complete todos los campos requeridos del formulario de contacto.');
            }
            return;
        }
        
        if (window.formHandler) {
            window.formHandler.showCommercialConditions();
        } else {
            console.error('formHandler not available');
        }
    } catch (error) {
        console.error('Error in proceedToCommercialConditions:', error);
        if (window.portalApp) {
            window.portalApp.showErrorMessage('Error al proceder al siguiente paso.');
        }
    }
};

window.proceedToSubmissionFromCommercial = function() {
    console.log('proceedToSubmissionFromCommercial called');
    try {
        // Wait for handlers to be ready
        if (!window.commercialConditionsHandler) {
            console.warn('commercialConditionsHandler not ready yet');
            setTimeout(() => window.proceedToSubmissionFromCommercial(), 100);
            return;
        }
        
        if (!window.commercialConditionsHandler.validateAllCommercialFields()) {
            if (window.portalApp) {
                window.portalApp.showErrorMessage('Por favor complete todos los campos requeridos del formulario de condiciones comerciales.');
            }
            return;
        }
        
        if (window.formHandler) {
            window.formHandler.submitForm();
        } else {
            console.error('formHandler not available');
        }
    } catch (error) {
        console.error('Error in proceedToSubmissionFromCommercial:', error);
        if (window.portalApp) {
            window.portalApp.showErrorMessage('Error al enviar el formulario.');
        }
    }
};

// Helper function for step validation
window.validateCurrentStep = () => {
    if (!window.formHandler) {
        return false;
    }
    
    const currentStep = window.formHandler.currentStep;
    
    switch (currentStep) {
        case 'documents':
            return window.formHandler.validationStatus?.opinion && 
                   window.formHandler.validationStatus?.constancia && 
                   window.formHandler.validationStatus?.bancario;
        case 'company':
            const nombreComercial = document.getElementById('nombre-comercial');
            return nombreComercial && nombreComercial.value && nombreComercial.value.trim().length > 0;
        case 'banking':
            return window.formHandler.validationStatus?.banking;
        case 'contact':
            return window.contactStepHandler?.isValid;
        case 'commercial':
            return window.commercialConditionsHandler?.isValid;
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
        contactStepHandler: window.contactStepHandler ? 'Ready' : 'Not ready',
        commercialConditionsHandler: window.commercialConditionsHandler ? 'Ready' : 'Not ready',
        currentStep: window.formHandler ? window.formHandler.currentStep : 'Unknown',
        firebaseStatus: {
            loaded: window.firebaseLoaded || false,
            available: typeof firebase !== 'undefined',
            dbReady: typeof window.firebaseDB !== 'undefined'
        }
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
    // Prevent the default behavior of logging to console
    event.preventDefault();
});