// ========================================
// MÓDULO PRINCIPAL: FormHandler
// Archivo: JS/form-handler.js
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
        // Initialize all modules
        this.documentValidator.initialize();
        this.bankingValidator.initialize();
        this.companyInfoHandler.initialize();
        this.contactInfoHandler.initialize();
        this.servicesInfoHandler.initialize();
        this.formSubmissionHandler.initialize();
        this.stepNavigator.initialize();
    }

    // Delegate methods to appropriate modules
    triggerFileUpload(type) {
        return this.documentValidator.triggerFileUpload(type);
    }

    handleFileUpload(type, input) {
        return this.documentValidator.handleFileUpload(type, input);
    }

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
        return this.stepNavigator.navigateToStep('documents');
    }

    submitForm() {
        return this.formSubmissionHandler.submitForm();
    }

    // Get current step validation status
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
                return true; // Review step is always valid
            default:
                return false;
        }
    }

    // Get all form data
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
                totalSteps: this.steps.length
            }
        };
    }
}

// Create global instance
window.formHandler = new FormHandler();

// ========================================
// MÓDULO: DocumentValidator
// Archivo: JS/modules/document-validator.js
// ========================================

export class DocumentValidator {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.uploadedFiles = {
            opinion: null,
            constancia: null,
            bancario: null
        };
        this.validationStatus = {
            opinion: false,
            constancia: false,
            bancario: false
        };
    }

    initialize() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        ['opinion', 'constancia', 'bancario'].forEach(type => {
            const fileInput = document.getElementById(`${type}-file`);
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileUpload(type, e.target));
            }
        });
    }

    triggerFileUpload(type) {
        const fileInput = document.getElementById(`${type}-file`);
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleFileUpload(type, input) {
        const file = input.files[0];
        if (!file) return;

        const validationResult = this.validateFile(file, type);
        if (!validationResult.valid) {
            this.showFileError(type, validationResult.error);
            input.value = '';
            return;
        }

        this.showLoading();

        try {
            this.uploadedFiles[type] = file;
            this.showFileInfo(type, file);
            
            if (['opinion', 'constancia', 'bancario'].includes(type)) {
                await this.processDocumentWithOCR(type, file);
            }

            this.updateUploadAreaAppearance(type, 'uploaded');
            this.checkOverallValidation();

        } catch (error) {
            console.error('Error processing file:', error);
            this.showFileError(type, error.message);
            this.uploadedFiles[type] = null;
            this.updateUploadAreaAppearance(type, 'error');
        } finally {
            this.hideLoading();
        }
    }

    validateFile(file, type) {
        if (file.type !== 'application/pdf') {
            return { valid: false, error: 'El archivo debe ser un PDF' };
        }

        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            return { valid: false, error: 'El archivo no debe exceder 2MB' };
        }

        return { valid: true };
    }

    async processDocumentWithOCR(type, file) {
        const extractedData = await window.ocrProcessor.processPDF(file, type);
        
        switch (type) {
            case 'opinion':
                this.validateOpinionDocument(extractedData);
                break;
            case 'constancia':
                this.validateConstanciaDocument(extractedData);
                break;
            case 'bancario':
                this.validateBancarioDocument(extractedData);
                break;
        }
    }

    // ... resto de métodos de validación ...

    isValid() {
        return this.validationStatus.opinion && 
               this.validationStatus.constancia && 
               this.validationStatus.bancario;
    }

    getValidationResults() {
        return {
            files: this.uploadedFiles,
            validation: this.validationStatus
        };
    }
}

// ========================================
// MÓDULO: BankingValidator  
// Archivo: JS/modules/banking-validator.js
// ========================================

export class BankingValidator {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.bankingData = {
            numeroCuenta: '',
            clabe: '',
            banco: '',
            sucursalBancaria: '',
            correoNotificaciones: '',
            telefonoCobranza: '',
            extension: '',
            swift: '',
            aba: '',
            iban: '',
            bic: '',
            convenioCie: ''
        };
        this.validationStatus = { banking: false };
    }

    initialize() {
        // Setup will be called when banking step is shown
    }

    setupBankingListeners() {
        const bankingFields = [
            'numero-cuenta', 'clabe', 'sucursal-bancaria', 
            'correo-pagos', 'telefono-cobranza', 'extension',
            'swift', 'aba', 'iban', 'bic', 'convenio-cie'
        ];

        bankingFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.removeEventListener('input', this.handleBankingInput);
                input.removeEventListener('blur', this.validateBankingData);
                
                if (fieldId === 'clabe') {
                    input.addEventListener('input', this.handleClabeInput.bind(this));
                } else if (fieldId === 'numero-cuenta') {
                    input.addEventListener('input', this.handleBankingInput.bind(this));
                } else if (fieldId === 'telefono-cobranza') {
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                    input.addEventListener('blur', this.validateBankingForm.bind(this));
                } else {
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                }
            }
        });
    }

    // ... resto de métodos de validación bancaria ...

    isValid() {
        return this.validationStatus.banking;
    }

    getFormData() {
        return { ...this.bankingData };
    }
}

// ========================================
// MÓDULO: StepNavigator
// Archivo: JS/modules/step-navigator.js  
// ========================================

export class StepNavigator {
    constructor(formHandler) {
        this.formHandler = formHandler;
    }

    initialize() {
        // Setup navigation event listeners
    }

    navigateToStep(targetStep) {
        const currentStepIndex = this.formHandler.steps.indexOf(this.formHandler.currentStep);
        const targetStepIndex = this.formHandler.steps.indexOf(targetStep);

        // Validate current step before moving forward
        if (targetStepIndex > currentStepIndex) {
            if (!this.formHandler.getCurrentStepValidation()) {
                this.showValidationError();
                return false;
            }
        }

        // Hide current step
        this.hideStep(this.formHandler.currentStep);
        
        // Show target step
        this.showStep(targetStep);
        
        // Update progress
        this.updateProgress(targetStep);
        
        // Update current step
        this.formHandler.currentStep = targetStep;
        
        // Setup step-specific listeners
        this.setupStepListeners(targetStep);
        
        return true;
    }

    hideStep(stepName) {
        const stepElement = document.getElementById(`${stepName}-step`);
        if (stepElement) {
            stepElement.classList.remove('active');
        }
    }

    showStep(stepName) {
        const stepElement = document.getElementById(`${stepName}-step`);
        if (stepElement) {
            stepElement.classList.add('active');
        }
    }

    updateProgress(stepName) {
        const stepIndex = this.formHandler.steps.indexOf(stepName);
        const percentage = ((stepIndex + 1) / this.formHandler.steps.length) * 100;
        const text = `Paso ${stepIndex + 1} de ${this.formHandler.steps.length}: ${this.getStepTitle(stepName)}`;
        
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = text;
    }

    getStepTitle(stepName) {
        const titles = {
            documents: 'Documentos',
            company: 'Información de la Empresa',
            contact: 'Información de Contacto',
            banking: 'Información Bancaria',
            services: 'Servicios y Capacidades',
            review: 'Revisión y Envío'
        };
        return titles[stepName] || stepName;
    }

    setupStepListeners(stepName) {
        switch (stepName) {
            case 'banking':
                this.formHandler.bankingValidator.setupBankingListeners();
                break;
            case 'contact':
                this.formHandler.contactInfoHandler.setupListeners();
                break;
            case 'services':
                this.formHandler.servicesInfoHandler.setupListeners();
                break;
        }
    }
}

// ========================================
// NUEVOS MÓDULOS PARA PASOS ADICIONALES
// ========================================

// ContactInfoHandler para información de contacto
export class ContactInfoHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.contactData = {};
    }

    initialize() {}
    setupListeners() {}
    isValid() { return true; }
    getFormData() { return this.contactData; }
}

// ServicesInfoHandler para servicios y capacidades
export class ServicesInfoHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.servicesData = {};
    }

    initialize() {}
    setupListeners() {}
    isValid() { return true; }
    getFormData() { return this.servicesData; }
}

// CompanyInfoHandler ya existente pero modularizado
export class CompanyInfoHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.companyData = {};
    }

    initialize() {}
    
    fillCompanyForm() {
        const companyInfo = window.ocrProcessor.getCompanyInfo();
        Object.keys(companyInfo).forEach(field => {
            const input = document.getElementById(this.mapFieldToId(field));
            if (input) {
                input.value = companyInfo[field];
                this.companyData[field] = companyInfo[field];
            }
        });
    }

    mapFieldToId(field) {
        const mapping = {
            nombreComercial: 'nombre-comercial',
            razonSocial: 'razon-social',
            rfc: 'rfc',
            tipoPersona: 'tipo-persona',
            calle: 'calle',
            numero: 'numero',
            colonia: 'colonia',
            ciudad: 'ciudad',
            estado: 'estado',
            cp: 'cp',
            pais: 'pais'
        };
        return mapping[field] || field;
    }

    isValid() {
        const nombreComercial = document.getElementById('nombre-comercial');
        return nombreComercial && nombreComercial.value && nombreComercial.value.trim().length > 0;
    }

    getFormData() {
        return { ...this.companyData };
    }
}

// FormSubmissionHandler para el envío final
export class FormSubmissionHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
    }

    initialize() {}

    async submitForm() {
        try {
            this.showLoading();
            
            const formData = this.formHandler.getAllFormData();
            const fileUrls = await this.uploadFilesToStorage();
            await this.saveToFirestore(formData, fileUrls);
            
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.hideLoading();
        }
    }

    // ... métodos de envío ...
}