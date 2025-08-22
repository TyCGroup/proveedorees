// Company Info Handler Module
export class CompanyInfoHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.companyData = {};
    }

    initialize() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Setup listener for the editable field (nombre-comercial)
        const nombreComercialInput = document.getElementById('nombre-comercial');
        if (nombreComercialInput) {
            nombreComercialInput.addEventListener('input', this.handleNombreComercialChange.bind(this));
            nombreComercialInput.addEventListener('blur', this.validateCompanyForm.bind(this));
        }
    }

    handleNombreComercialChange(event) {
        const value = event.target.value.trim();
        this.companyData.nombreComercial = value;
        this.validateCompanyForm();
    }

    validateCompanyForm() {
        const nombreComercial = document.getElementById('nombre-comercial');
        const isValid = nombreComercial && nombreComercial.value && nombreComercial.value.trim().length > 0;
        
        // Enable/disable next button based on validation
        const nextButton = this.getNextButton();
        if (nextButton) {
            nextButton.disabled = !isValid;
        }
        
        // Show validation feedback
        this.showValidationFeedback(isValid);
        
        return isValid;
    }

    showValidationFeedback(isValid) {
        const nombreComercialInput = document.getElementById('nombre-comercial');
        if (nombreComercialInput) {
            nombreComercialInput.classList.toggle('valid', isValid);
            nombreComercialInput.classList.toggle('invalid', !isValid && nombreComercialInput.value.length > 0);
        }
        
        // Show/hide validation message
        let validationMsg = document.getElementById('company-validation-message');
        if (!validationMsg) {
            validationMsg = document.createElement('div');
            validationMsg.id = 'company-validation-message';
            validationMsg.className = 'validation-message';
            const companyGrid = document.querySelector('#company-step .form-grid');
            if (companyGrid) {
                companyGrid.appendChild(validationMsg);
            }
        }
        
        if (!isValid && nombreComercialInput.value.length > 0) {
            validationMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> El nombre comercial es requerido';
            validationMsg.className = 'validation-message error';
            validationMsg.style.display = 'block';
        } else if (isValid) {
            validationMsg.innerHTML = '<i class="fas fa-check-circle"></i> Información de empresa válida';
            validationMsg.className = 'validation-message success';
            validationMsg.style.display = 'block';
        } else {
            validationMsg.style.display = 'none';
        }
    }

    getNextButton() {
        // In company step, the next button goes to banking (or contact if added)
        return document.querySelector('#company-step .btn-primary:not(.btn-secondary)');
    }
    
    fillCompanyForm() {
        const companyInfo = window.ocrProcessor.getCompanyInfo();
        
        Object.keys(companyInfo).forEach(field => {
            const input = document.getElementById(this.mapFieldToId(field));
            if (input) {
                input.value = companyInfo[field];
                this.companyData[field] = companyInfo[field];
            }
        });
        
        // Validate after filling
        setTimeout(() => {
            this.validateCompanyForm();
        }, 100);
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

    collectFormData() {
        const formData = {};
        
        // Get all company form inputs
        const companyInputs = document.querySelectorAll('#company-step input');
        companyInputs.forEach(input => {
            if (input.name) {
                formData[input.name] = input.value;
            }
        });
        
        // Merge with internal data
        return { ...formData, ...this.companyData };
    }

    isValid() {
        const nombreComercial = document.getElementById('nombre-comercial');
        return nombreComercial && nombreComercial.value && nombreComercial.value.trim().length > 0;
    }

    getFormData() {
        return this.collectFormData();
    }

    reset() {
        this.companyData = {};
        
        // Clear editable fields (readonly fields will be cleared by OCR reset)
        const nombreComercialInput = document.getElementById('nombre-comercial');
        if (nombreComercialInput) {
            nombreComercialInput.value = '';
        }
        
        // Hide validation messages
        const validationMsg = document.getElementById('company-validation-message');
        if (validationMsg) {
            validationMsg.style.display = 'none';
        }
    }
}

// Export the class
export { CompanyInfoHandler };