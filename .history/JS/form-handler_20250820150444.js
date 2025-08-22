// ========================================
// FORM HANDLER PRINCIPAL - VERSIÓN MODULAR
// ========================================

import { DocumentValidator } from './modules/document-validator.js';
import { BankingValidator } from './modules/banking-validator.js';
import { CompanyInfoHandler } from './modules/company-info-handler.js';
import { ContactInfoHandler } from './modules/contact-info-handler.js';
import { ServicesInfoHandler } from './modules/services-info-handler.js';
import { FormSubmissionHandler } from './modules/form-submission-handler.js';
import { StepNavigator } from './modules/step-navigator.js';

class FormHandler {
    constructor() {
        this.currentStep = 'documents';
        this.steps = ['documents', 'company', 'contact', 'banking', 'services', 'review'];
        
        // Initialize all modules
        this.documentValidator = new DocumentValidator(this);
        this.bankingValidator = new BankingValidator(this);
        this.companyInfoHandler = new CompanyInfoHandler(this);
        this.contactInfoHandler = new ContactInfoHandler(this);
        this.servicesInfoHandler = new ServicesInfoHandler(this);
        this.formSubmissionHandler = new FormSubmissionHandler(this);
        this.stepNavigator = new StepNavigator(this);
        
        this.initialize();
    }

    initialize() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        try {
            // Initialize all modules
            this.documentValidator.initialize();
            this.bankingValidator.initialize();
            this.companyInfoHandler.initialize();
            this.contactInfoHandler.initialize();
            this.servicesInfoHandler.initialize();
            this.formSubmissionHandler.initialize();
            this.stepNavigator.initialize();

            // Setup declaration checkbox handler
            this.setupDeclarationHandler();

            console.log('Form Handler initialized successfully with all modules');
        } catch (error) {
            console.error('Error initializing Form Handler:', error);
        }
    }

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

    // ========================================
    // DELEGATION METHODS - For backward compatibility
    // ========================================

    // Document methods
    triggerFileUpload(type) {
        return this.documentValidator.triggerFileUpload(type);
    }

    handleFileUpload(type, input) {
        return this.documentValidator.handleFileUpload(type, input);
    }

    // Navigation methods
    showCompanyInfo() {
        return this.stepNavigator.navigateToStep('company');
    }

    showContactInfo() {
        return this.stepNavigator.navigateToStep('contact');
    }

    showBankingInfo() {
        return this.stepNavigator.navigateToStep('banking');
    }

    showServicesInfo() {
        return this.stepNavigator.navigateToStep('services');
    }

    showReview() {
        return this.stepNavigator.navigateToStep('review');
    }

    showDocuments() {
        return this.stepNavigator.goToPreviousStep();
    }

    // Form submission
    submitForm() {
        return this.formSubmissionHandler.submitForm();
    }

    // ========================================
    // VALIDATION AND DATA COLLECTION
    // ========================================

    getCurrentStepValidation() {
        switch (this.currentStep) {
            case 'documents':
                return this.documentValidator.isValid();
            case 'company':
                return this.companyInfoHandler.isValid();
            case 'contact':
                return this.contactInfoHandler.isValid();
            case 'banking':
                return this.bankingValidator.isValid();
            case 'services':
                return this.servicesInfoHandler.isValid();
            case 'review':
                return true; // Review step is always valid if reached
            default:
                return false;
        }
    }

    getAllFormData() {
        return {
            documents: this.documentValidator.getValidationResults(),
            company: this.companyInfoHandler.getFormData(),
            contact: this.contactInfoHandler.getFormData(),
            banking: this.bankingValidator.getFormData(),
            services: this.servicesInfoHandler.getFormData(),
            metadata: {
                submissionDate: new Date().toISOString(),
                currentStep: this.currentStep,
                totalSteps: this.steps.length,
                version: '2.0-modular'
            }
        };
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    resetAllModules() {
        this.documentValidator.reset();
        this.bankingValidator.reset();
        this.companyInfoHandler.reset();
        this.contactInfoHandler.reset();
        this.servicesInfoHandler.reset();
        
        this.currentStep = 'documents';
        this.stepNavigator.navigateToStep('documents', false);
    }

    getModuleStatus() {
        return {
            documents: {
                ready: !!this.documentValidator,
                valid: this.documentValidator?.isValid() || false
            },
            company: {
                ready: !!this.companyInfoHandler,
                valid: this.companyInfoHandler?.isValid() || false
            },
            contact: {
                ready: !!this.contactInfoHandler,
                valid: this.contactInfoHandler?.isValid() || false
            },
            banking: {
                ready: !!this.bankingValidator,
                valid: this.bankingValidator?.isValid() || false
            },
            services: {
                ready: !!this.servicesInfoHandler,
                valid: this.servicesInfoHandler?.isValid() || false
            },
            submission: {
                ready: !!this.formSubmissionHandler
            },
            navigation: {
                ready: !!this.stepNavigator,
                currentStep: this.currentStep,
                canProceed: this.getCurrentStepValidation()
            }
        };
    }

    // Debug method
    debugInfo() {
        return {
            currentStep: this.currentStep,
            allSteps: this.steps,
            moduleStatus: this.getModuleStatus(),
            formData: this.getAllFormData(),
            validation: {
                currentStepValid: this.getCurrentStepValidation(),
                allStepsStatus: this.steps.map(step => ({
                    step,
                    valid: this.getStepValidation(step)
                }))
            }
        };
    }

    getStepValidation(stepName) {
        const currentStep = this.currentStep;
        this.currentStep = stepName; // Temporarily switch
        const isValid = this.getCurrentStepValidation();
        this.currentStep = currentStep; // Switch back
        return isValid;
    }
}

// ========================================
// GLOBAL INSTANCE AND FUNCTIONS
// ========================================

// Create global instance
window.formHandler = new FormHandler();

// Global functions for HTML onclick events (backward compatibility)
window.triggerFileUpload = (type) => window.formHandler?.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler?.handleFileUpload(type, input);
window.showCompanyInfo = () => window.formHandler?.showCompanyInfo();
window.showContactInfo = () => window.formHandler?.showContactInfo();
window.showBankingInfo = () => window.formHandler?.showBankingInfo();
window.showServicesInfo = () => window.formHandler?.showServicesInfo();
window.showReview = () => window.formHandler?.showReview();
window.showDocuments = () => window.formHandler?.showDocuments();
window.submitForm = () => window.formHandler?.submitForm();

// Enhanced global helper functions
window.validateCurrentStep = () => {
    return window.formHandler?.getCurrentStepValidation() || false;
};

window.getFormStatus = () => {
    return window.formHandler?.getModuleStatus() || {};
};

window.getFormDebugInfo = () => {
    return window.formHandler?.debugInfo() || {};
};

window.resetForm = () => {
    return window.formHandler?.resetAllModules();
};

// Expose FormHandler class for debugging
window.FormHandler = FormHandler;

console.log('Modular Form Handler loaded successfully');