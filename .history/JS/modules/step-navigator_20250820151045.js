// Step Navigator Module
export class StepNavigator {
    constructor(formHandler) {
        this.formHandler = formHandler;
    }

    initialize() {
        this.setupNavigationEventListeners();
    }

    setupNavigationEventListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.step) {
                this.navigateToStep(event.state.step, false);
            }
        });
    }

    navigateToStep(targetStep, validateCurrent = true) {
        const currentStepIndex = this.formHandler.steps.indexOf(this.formHandler.currentStep);
        const targetStepIndex = this.formHandler.steps.indexOf(targetStep);

        // Validate current step before moving forward
        if (validateCurrent && targetStepIndex > currentStepIndex) {
            if (!this.formHandler.getCurrentStepValidation()) {
                this.showValidationError();
                return false;
            }
        }

        // Perform any step-specific pre-navigation actions
        this.performPreNavigationActions(targetStep);

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
        
        // Add to browser history
        const title = `${this.getStepTitle(targetStep)} - Portal T&C Group`;
        history.pushState(
            { step: targetStep }, 
            title, 
            `#${targetStep}`
        );
        document.title = title;
        
        return true;
    }

    performPreNavigationActions(targetStep) {
        switch (targetStep) {
            case 'company':
                // Fill company form with OCR data when navigating to company step
                this.formHandler.companyInfoHandler.fillCompanyForm();
                break;
            case 'review':
                // Prepare review data when navigating to review step
                this.prepareReviewData();
                break;
        }
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
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = text;
        }
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

    showValidationError() {
        const currentStepTitle = this.getStepTitle(this.formHandler.currentStep);
        const message = `Por favor complete todos los campos requeridos en "${currentStepTitle}" antes de continuar.`;
        
        if (window.portalApp) {
            window.portalApp.showErrorMessage(message);
        }
    }

    prepareReviewData() {
        // Collect all form data for review
        const allData = this.formHandler.getAllFormData();
        this.displayReviewData(allData);
    }

    displayReviewData(data) {
        // Update review step with collected data
        const reviewContainer = document.getElementById('review-container');
        if (!reviewContainer) return;
        
        reviewContainer.innerHTML = `
            <div class="review-section">
                <h3>Documentos</h3>
                <div class="review-item">
                    <strong>Archivos subidos:</strong>
                    <ul>
                        ${Object.keys(data.documents.files).map(key => 
                            data.documents.files[key] ? `<li>${key}: ${data.documents.files[key].name}</li>` : ''
                        ).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="review-section">
                <h3>Información de la Empresa</h3>
                <div class="review-item">
                    <strong>Nombre Comercial:</strong> ${data.company.nombreComercial || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>Razón Social:</strong> ${data.company.razonSocial || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>RFC:</strong> ${data.company.rfc || 'No especificado'}
                </div>
            </div>
            
            <div class="review-section">
                <h3>Información de Contacto</h3>
                <div class="review-item">
                    <strong>Representante Legal:</strong> ${data.contact.representanteLegal?.nombre || ''} ${data.contact.representanteLegal?.apellidos || ''}
                </div>
                <div class="review-item">
                    <strong>Email:</strong> ${data.contact.representanteLegal?.email || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>Teléfono:</strong> ${data.contact.representanteLegal?.telefono || 'No especificado'}
                </div>
            </div>
            
            <div class="review-section">
                <h3>Información Bancaria</h3>
                <div class="review-item">
                    <strong>Banco:</strong> ${data.banking.banco || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>CLABE:</strong> ${data.banking.clabe || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>Número de Cuenta:</strong> ${data.banking.numeroCuenta || 'No especificado'}
                </div>
            </div>
            
            <div class="review-section">
                <h3>Servicios</h3>
                <div class="review-item">
                    <strong>Categorías:</strong> ${data.services.categoriasPrincipales?.join(', ') || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>Años de Experiencia:</strong> ${data.services.experienciaAnios || 'No especificado'}
                </div>
                <div class="review-item">
                    <strong>Referencias:</strong> ${data.services.referencias?.length || 0} referencias
                </div>
            </div>
        `;
    }

    // Navigation helper methods for backward compatibility
    goToPreviousStep() {
        const currentIndex = this.formHandler.steps.indexOf(this.formHandler.currentStep);
        if (currentIndex > 0) {
            const previousStep = this.formHandler.steps[currentIndex - 1];
            this.navigateToStep(previousStep, false);
        }
    }

    goToNextStep() {
        const currentIndex = this.formHandler.steps.indexOf(this.formHandler.currentStep);
        if (currentIndex < this.formHandler.steps.length - 1) {
            const nextStep = this.formHandler.steps[currentIndex + 1];
            this.navigateToStep(nextStep, true);
        }
    }

    canNavigateForward() {
        return this.formHandler.getCurrentStepValidation();
    }

    getCurrentStepIndex() {
        return this.formHandler.steps.indexOf(this.formHandler.currentStep);
    }

    getTotalSteps() {
        return this.formHandler.steps.length;
    }
}

// Export the class
export { StepNavigator };