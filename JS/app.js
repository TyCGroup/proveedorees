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
            // PDF.js worker
            if (typeof pdfjsLib !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }

            // Firebase
            this.initializeFirebase();

            // Listeners globales
            this.setupEventListeners();

            // NUEVO: Eventos del pipeline (subida y extracción SAT)
            this.setupDocPipelineEvents();

            // Sección inicial
            this.showSection('welcome');

            this.initialized = true;
            console.log('Portal application initialized successfully');

            // Progreso inicial
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
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK not loaded');
                return;
            }

            setTimeout(() => {
                if (window.firebaseLoaded && window.firebaseDB) {
                    console.log('Firebase connection verified');
                    this.firebaseReady = true;
                } else {
                    console.warn('Firebase services not ready, will retry...');
                    this.firebaseReady = false;
                    setTimeout(() => {
                        if (window.firebaseLoaded && window.firebaseDB) {
                            console.log('Firebase connection verified on retry');
                            this.firebaseReady = true;
                        } else {
                            console.error('Firebase failed to initialize after retries');
                        }
                    }, 2000);
                }
            }, 500);
        } catch (error) {
            console.error('Firebase initialization error:', error);
            this.firebaseReady = false;
        }
    }

    // Set up global event listeners
    setupEventListeners() {
        // Back/forward
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.section) {
                this.showSection(event.state.section, false);
            }
        });

        // Avoid real submits
        document.addEventListener('submit', (event) => {
            event.preventDefault();
        });

        // Escape -> cerrar modales si no hay loading activo
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const loadingOverlay = document.getElementById('loading-overlay');
                if (!loadingOverlay || !loadingOverlay.classList.contains('active')) {
                    this.hideModals();
                }
            }
        });

        // Drag & Drop
        this.setupDragAndDrop();

        // Network status
        this.setupNetworkHandlers();

        // Checkbox declaración
        this.setupDeclarationHandler();
    }

    // NUEVO: Eventos del pipeline de documentos
    setupDocPipelineEvents() {
        // 1) Cuando un archivo se sube a Storage (lo emite ocr-processor con uploadOnly)
        window.addEventListener('fileUploaded', (e) => {
            const { docType, url } = (e && e.detail) || {};
            if (!docType || !url) return;

            const pretty = this.prettyDocName(docType);
            this.showSuccessMessage(`${pretty} cargado correctamente.`);

            // Si quieres, enfocar la siguiente acción del usuario
            if (docType === 'opinion' || docType === 'constancia') {
                // Autorrellenar si ya llegaron datos del SAT antes
                // (el rellenado real se hace en satExtracted, esto es solo refuerzo UX)
                // No hacemos nada extra aquí.
            }
        });

        // 2) Cuando se extrajeron datos desde SAT (QR/folio)
        window.addEventListener('satExtracted', (e) => {
            try {
                const { tipo, fields } = (e && e.detail) || {};
                const pretty = tipo ? this.prettyDocName(tipo) : 'Documento';
                this.showSuccessMessage(`Datos del ${pretty} extraídos correctamente.`);
                // Autorrellenar el formulario de empresa si tenemos campos útiles
                if (fields) this.prefillFromSAT(fields);
            } catch (err) {
                console.warn('satExtracted handler error:', err);
            }
        });
    }

    // Nombre "bonito" para UI
    prettyDocName(type) {
        const map = { opinion: 'Opinión 32D', constancia: 'Constancia Fiscal', bancario: 'Estado de Cuenta' };
        return map[type] || type;
    }

    // Autorrelleno de formulario con lo extraído del SAT
    prefillFromSAT(fields) {
        // La forma puede variar; aceptamos varias estructuras:
        // - fields.companyInfo {...}
        // - fields directamente con { companyName, rfc, address:{...}, tipoPersona }
        const src = fields.companyInfo || fields || {};
        const addr = src.address || src || {};

        const setIfEmpty = (id, val) => {
            const el = document.getElementById(id);
            if (el && val && (el.value === '' || el.value == null)) {
                el.value = val;
            }
        };

        // Empresa / RFC
        setIfEmpty('razon-social', src.companyName || src.razonSocial);
        setIfEmpty('nombre-comercial', src.companyName || src.razonSocial);
        setIfEmpty('rfc', src.rfc);
        setIfEmpty('tipo-persona', src.tipoPersona);

        // Domicilio
        setIfEmpty('calle', addr.street);
        setIfEmpty('numero', addr.number);
        setIfEmpty('colonia', addr.colony);
        setIfEmpty('ciudad', addr.city);
        setIfEmpty('estado', addr.state);
        setIfEmpty('cp', addr.postalCode);
        setIfEmpty('pais', addr.country || 'México');
    }

    // Setup declaration checkbox handler
    setupDeclarationHandler() {
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

    // Drag & Drop
    setupDragAndDrop() {
        document.addEventListener('dragover', (event) => {
            event.preventDefault();
        });

        document.addEventListener('drop', (event) => {
            event.preventDefault();
            const uploadArea = event.target.closest('.upload-area');
            if (!uploadArea) return;

            const files = event.dataTransfer.files;
            if (!files || files.length === 0) return;

            // Asegurar PDF
            if (files[0].type !== 'application/pdf') {
                this.showErrorMessage('El archivo debe ser PDF.');
                return;
            }

            const input = uploadArea.querySelector('input[type="file"]');
            if (input) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(files[0]);
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // Network status
    setupNetworkHandlers() {
        window.addEventListener('online', () => this.hideNetworkError());
        window.addEventListener('offline', () => this.showNetworkError());
    }

    // Show specific section
    showSection(sectionName, addToHistory = true) {
        try {
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });

            const targetSection = document.getElementById(`${sectionName}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                this.currentSection = sectionName;

                if (addToHistory) {
                    const title = this.getSectionTitle(sectionName);
                    history.pushState({ section: sectionName }, title, `#${sectionName}`);
                    document.title = title;
                }

                window.scrollTo({ top: 0, behavior: 'smooth' });
                this.trackPageView(sectionName);
                this.setupSectionHandlers(sectionName);
            }
        } catch (error) {
            console.error('Error showing section:', error);
        }
    }

    // Section-specific handlers
    setupSectionHandlers(sectionName) {
        if (sectionName === 'declaration') {
            setTimeout(() => this.setupDeclarationHandler(), 50);
        }
    }

    // Titles
    getSectionTitle(sectionName) {
        const titles = {
            welcome: 'Bienvenido - Portal de Socios Comerciales T&C Group',
            declaration: 'Declaración de Responsabilidad - Portal T&C Group',
            form: 'Registro de Proveedor - Portal T&C Group'
        };
        return titles[sectionName] || 'Portal de Socios Comerciales T&C Group';
    }

    // Public helpers to switch sections
    showWelcome() { this.showSection('welcome'); }
    showDeclaration() { this.showSection('declaration'); }

    showForm() {
        const checkbox = document.getElementById('accept-declaration');
        if (!checkbox || !checkbox.checked) {
            this.showErrorMessage('Debe aceptar la Declaración de Responsabilidad para continuar.');
            return;
        }
        this.showSection('form');
    }

    // --- Toasters ---
    showErrorMessage(message) {
        // Remove existing
        document.querySelectorAll('.error-notification').forEach(el => el.remove());

        const el = document.createElement('div');
        el.className = 'error-notification';
        el.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .error-notification {
                    position: fixed; top: 20px; right: 20px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white; padding: 1rem; border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10000; max-width: 400px; animation: slideInRight 0.3s ease-out;
                }
                .notification-content { display: flex; align-items: center; gap: 0.5rem; }
                .notification-content button {
                    background: none; border: none; color: white; cursor: pointer;
                    padding: 0.25rem; margin-left: auto; border-radius: 4px;
                }
                .notification-content button:hover { background: rgba(255,255,255,.1); }
                @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; } }
            `;
            document.head.appendChild(styles);
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 5000);
    }

    showSuccessMessage(message) {
        document.querySelectorAll('.success-notification').forEach(el => el.remove());

        const el = document.createElement('div');
        el.className = 'success-notification';
        el.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        if (!document.getElementById('success-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'success-notification-styles';
            styles.textContent = `
                .success-notification {
                    position: fixed; top: 20px; right: 20px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white; padding: 1rem; border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10000; max-width: 400px; animation: slideInRight 0.3s ease-out;
                }
                .success-notification .notification-content { display:flex; align-items:center; gap:.5rem; }
                .success-notification .notification-content button {
                    background:none; border:none; color:white; cursor:pointer;
                    padding:.25rem; margin-left:auto; border-radius:4px;
                }
                .success-notification .notification-content button:hover { background: rgba(255,255,255,.1); }
            `;
            document.head.appendChild(styles);
        }
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 5000);
    }

    // Network banners
    showNetworkError() {
        this.hideNetworkError();
        const el = document.createElement('div');
        el.id = 'network-error';
        el.innerHTML = `
            <div class="network-error-content">
                <i class="fas fa-wifi"></i>
                <span>Sin conexión a internet. Algunas funciones pueden no estar disponibles.</span>
            </div>
        `;
        if (!document.getElementById('network-error-styles')) {
            const styles = document.createElement('style');
            styles.id = 'network-error-styles';
            styles.textContent = `
                #network-error {
                    position: fixed; top: 0; left: 0; right: 0;
                    background: #f59e0b; color: white; padding: .5rem;
                    text-align: center; z-index: 10001; font-weight: 500;
                    animation: slideInDown .3s ease-out;
                }
                .network-error-content { display:flex; align-items:center; justify-content:center; gap:.5rem; }
                @keyframes slideInDown { from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; } }
            `;
            document.head.appendChild(styles);
        }
        document.body.appendChild(el);
    }
    hideNetworkError() {
        const el = document.getElementById('network-error');
        if (el) el.remove();
    }

    // Hide modals
    hideModals() {
        document.querySelectorAll('.modal, .loading-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Analytics
    trackPageView(sectionName) {
        if (typeof gtag !== 'undefined') {
            gtag('config', 'GA_MEASUREMENT_ID', {
                page_title: this.getSectionTitle(sectionName),
                page_location: window.location.href
            });
        }
        console.log(`Page view: ${sectionName}`);
    }

    // Utils
    formatDate(date) {
        if (!date) return '';
        const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Mexico_City' };
        return new Intl.DateTimeFormat('es-MX', options).format(date);
    }
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Status
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

window.showWelcome = () => window.portalApp?.showWelcome();
window.showDeclaration = () => window.portalApp?.showDeclaration();
window.showForm = () => window.portalApp?.showForm();

window.triggerFileUpload = (type) => window.formHandler?.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler?.handleFileUpload(type, input);

window.showCompanyInfo = () => window.formHandler?.showCompanyInfo();
window.showBankingInfo = () => window.formHandler?.showBankingInfo();
window.showContactInfo = () => window.formHandler?.showContactInfo();
window.showCommercialConditions = () => window.formHandler?.showCommercialConditions();
window.showDocuments = () => window.formHandler?.showDocuments();
window.submitForm = () => window.formHandler?.submitForm();

window.proceedToCommercialConditions = function() {
    console.log('proceedToCommercialConditions called');
    try {
        if (!window.contactStepHandler) {
            console.warn('contactStepHandler not ready yet');
            setTimeout(() => window.proceedToCommercialConditions(), 100);
            return;
        }
        if (!window.contactStepHandler.validateAllContactFields()) {
            if (window.portalApp) window.portalApp.showErrorMessage('Por favor complete todos los campos requeridos del formulario de contacto.');
            return;
        }
        if (window.formHandler) window.formHandler.showCommercialConditions();
        else console.error('formHandler not available');
    } catch (error) {
        console.error('Error in proceedToCommercialConditions:', error);
        if (window.portalApp) window.portalApp.showErrorMessage('Error al proceder al siguiente paso.');
    }
};

window.proceedToSubmissionFromCommercial = function() {
    console.log('proceedToSubmissionFromCommercial called');
    try {
        if (!window.commercialConditionsHandler) {
            console.warn('commercialConditionsHandler not ready yet');
            setTimeout(() => window.proceedToSubmissionFromCommercial(), 100);
            return;
        }
        if (!window.commercialConditionsHandler.validateAllCommercialFields()) {
            if (window.portalApp) window.portalApp.showErrorMessage('Por favor complete todos los campos requeridos del formulario de condiciones comerciales.');
            return;
        }
        if (window.formHandler) window.formHandler.submitForm();
        else console.error('formHandler not available');
    } catch (error) {
        console.error('Error in proceedToSubmissionFromCommercial:', error);
        if (window.portalApp) window.portalApp.showErrorMessage('Error al enviar el formulario.');
    }
};

window.validateCurrentStep = () => {
    if (!window.formHandler) return false;
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

window.canProceedToNextStep = () => window.validateCurrentStep();
window.getCurrentFormStep = () => window.formHandler ? window.formHandler.currentStep : null;

// ========================================
// APPLICATION INITIALIZATION
// ========================================

window.portalApp = new PortalApp();
window.PortalApp = PortalApp;

// Global error handlers
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.portalApp) {
        window.portalApp.showErrorMessage('Ha ocurrido un error inesperado. Por favor, recargue la página.');
    }
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.portalApp) {
        window.portalApp.showErrorMessage('Error en el procesamiento. Por favor, intente nuevamente.');
    }
    event.preventDefault();
});
