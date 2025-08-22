// form-handler-core.js - Core functionality
class FormHandlerCore {
    constructor() {
        this.uploadedFiles = {
            opinion: null,
            constancia: null,
            bancario: null
        };
        this.validationStatus = {
            opinion: false,
            constancia: false,
            bancario: false,
            banking: false
        };
        this.currentStep = 'documents';
        this.stepData = {
            company: {},
            banking: {},
            // Preparado para futuros pasos
            additional1: {},
            additional2: {},
            additional3: {}
        };
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Declaration checkbox
        const declarationCheckbox = document.getElementById('accept-declaration');
        if (declarationCheckbox) {
            declarationCheckbox.addEventListener('change', this.handleDeclarationChange.bind(this));
        }

        // Initialize each module
        this.initializeDocumentListeners();
        this.initializeNavigationListeners();
    }

    // Handle declaration checkbox
    handleDeclarationChange(event) {
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.disabled = !event.target.checked;
        }
    }

    // Update progress bar
    updateProgress(percentage, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = text;
        }
    }

    // Show/hide loading overlay
    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    // Show error message
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            Error: ${message}
        `;
        
        const formCard = document.querySelector('.form-card');
        formCard.insertBefore(errorDiv, formCard.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Reset entire form
    reset() {
        this.uploadedFiles = {
            opinion: null,
            constancia: null,
            bancario: null
        };
        this.validationStatus = {
            opinion: false,
            constancia: false,
            bancario: false,
            banking: false
        };
        this.stepData = {
            company: {},
            banking: {},
            additional1: {},
            additional2: {},
            additional3: {}
        };
        this.currentStep = 'documents';
        
        // Reset each module
        this.resetDocuments();
        this.resetBanking();
        // Preparado para futuros resets
    }

    // Placeholder methods that will be implemented by mixins
    initializeDocumentListeners() { /* Implemented by documents module */ }
    initializeNavigationListeners() { /* Implemented by navigation module */ }
    resetDocuments() { /* Implemented by documents module */ }
    resetBanking() { /* Implemented by banking module */ }
}