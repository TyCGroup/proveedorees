// form-handler-banking.js - Banking information handling
const FormHandlerBanking = {
    // Initialize banking data
    initializeBankingData() {
        this.stepData.banking = {
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
    },

    // Setup banking form event listeners
    setupBankingListeners() {
        const bankingFields = [
            'numero-cuenta', 'clabe', 'sucursal-bancaria', 
            'correo-pagos', 'telefono-cobranza', 'extension',
            'swift', 'aba', 'iban', 'bic', 'convenio-cie'
        ];

        bankingFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                if (fieldId === 'numero-cuenta' || fieldId === 'clabe') {
                    if (fieldId === 'clabe') {
                        input.addEventListener('input', this.handleClabeInput.bind(this));
                    } else {
                        input.addEventListener('input', this.handleBankingInput.bind(this));
                    }
                    input.addEventListener('blur', this.validateBankingData.bind(this));
                } else if (fieldId === 'telefono-cobranza') {
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                    input.addEventListener('blur', this.validateBankingForm.bind(this));
                } else {
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                }
            }
        });
    },

    // Handle general banking input
    handleGeneralBankingInput(event) {
        const input = event.target;
        let value = input.value;
        
        const fieldMapping = {
            'sucursal-bancaria': 'sucursalBancaria',
            'correo-pagos': 'correoNotificaciones',
            'telefono-cobranza': 'telefonoCobranza',
            'extension': 'extension',
            'swift': 'swift',
            'aba': 'aba', 
            'iban': 'iban',
            'bic': 'bic',
            'convenio-cie': 'convenioCie'
        };
        
        // Field-specific validations
        switch (input.id) {
            case 'telefono-cobranza':
                value = value.replace(/[^\d\s-]/g, '');
                break;
            case 'extension':
                value = value.replace(/\D/g, '');
                break;
            case 'swift':
            case 'bic':
                value = value.toUpperCase();
                break;
            case 'aba':
                value = value.replace(/\D/g, '');
                break;
            case 'iban':
                value = value.replace(/\s/g, '').toUpperCase();
                break;
            case 'convenio-cie':
                value = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                break;
        }
        
        input.value = value;
        
        const dataKey = fieldMapping[input.id];
        if (dataKey) {
            this.stepData.banking[dataKey] = value;
        }
        
        if (input.required) {
            this.validateBankingForm();
        }
    },

    // Handle banking input (account numbers)
    handleBankingInput(event) {
        const input = event.target;
        let value = input.value.replace(/\D/g, '');
        
        if (input.id === 'numero-cuenta') {
            value = value.slice(0, 20);
            this.stepData.banking.numeroCuenta = value;
        }
        
        input.value = value;
    },

    // Handle CLABE input with formatting
    handleClabeInput(event) {
        const input = event.target;
        let value = input.value.replace(/\D/g, '');
        
        value = value.slice(0, 18);
        
        input.value = value;
        this.stepData.banking.clabe = value;
        
        const isValid = value.length === 18;
        input.classList.toggle('valid', isValid);
        input.classList.toggle('invalid', value.length > 0 && !isValid);
    },

    // Validate banking form
    validateBankingForm() {
        const numeroCuenta = document.getElementById('numero-cuenta').value;
        const clabe = document.getElementById('clabe').value;
        const telefonoCobranza = document.getElementById('telefono-cobranza').value;
        
        const requiredFieldsValid = numeroCuenta && clabe && telefonoCobranza;
        
        if (requiredFieldsValid) {
            this.validateBankingData();
        } else {
            this.disableFinishButton();
        }
    },

    // Validate banking data against OCR
    async validateBankingData() {
        const numeroCuenta = document.getElementById('numero-cuenta').value;
        const clabe = document.getElementById('clabe').value;
        const telefonoCobranza = document.getElementById('telefono-cobranza').value;
        
        if (!numeroCuenta || !clabe || !telefonoCobranza) {
            return;
        }

        if (!this.validatePhoneNumber(telefonoCobranza)) {
            this.showBankingOverallValidation('error', 'El teléfono de cobranza debe tener un formato válido (10 dígitos mínimo).');
            this.validationStatus.banking = false;
            this.disableFinishButton();
            return;
        }

        this.showBankingValidationResults();
        
        try {
            const validation = window.ocrProcessor.validateBankingInfo(numeroCuenta, clabe);
            
            this.updateBankingValidation('cuenta', validation.details.numeroCuenta);
            this.updateBankingValidation('clabe', validation.details.clabe);
            this.updateBankingValidation('banco', { valid: !!validation.bankName, bankName: validation.bankName });
            
            if (validation.bankName) {
                document.getElementById('banco').value = validation.bankName;
                this.stepData.banking.banco = validation.bankName;
            }
            
            if (validation.valid) {
                this.showBankingOverallValidation('success', 'Información bancaria validada correctamente.');
                this.validationStatus.banking = true;
                this.enableFinishButton();
            } else {
                this.showBankingOverallValidation('error', `Errores en validación: ${validation.errors.join('. ')}`);
                this.validationStatus.banking = false;
                this.disableFinishButton();
            }
            
        } catch (error) {
            console.error('Error validating banking data:', error);
            this.showBankingOverallValidation('error', 'Error al validar la información bancaria.');
            this.validationStatus.banking = false;
            this.disableFinishButton();
        }
    },

    // Validate phone number
    validatePhoneNumber(phone) {
        const cleanPhone = phone.replace(/[\s-]/g, '');
        return /^\d{10,}$/.test(cleanPhone);
    },

    // Show banking validation results
    showBankingValidationResults() {
        const resultsDiv = document.getElementById('banking-validation-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            
            ['cuenta', 'clabe', 'banco'].forEach(type => {
                const item = document.getElementById(`${type}-validation`);
                if (item) {
                    item.className = 'validation-item validating';
                    item.innerHTML = `
                        <i class="fas fa-spinner"></i>
                        <span>Validando ${type === 'cuenta' ? 'número de cuenta' : type === 'clabe' ? 'CLABE' : 'banco'}...</span>
                    `;
                }
            });
        }
    },

    // Update banking validation
    updateBankingValidation(type, result) {
        const item = document.getElementById(`${type}-validation`);
        if (!item) return;
        
        let icon, message, className;
        
        if (type === 'banco') {
            if (result.valid && result.bankName) {
                icon = 'fa-check-circle';
                message = `Banco detectado: ${result.bankName}`;
                className = 'success';
            } else {
                icon = 'fa-exclamation-triangle';
                message = 'No se pudo detectar el banco automáticamente';
                className = 'warning';
            }
        } else {
            if (result.valid) {
                icon = 'fa-check-circle';
                message = result.warning ? 
                    `Validado con advertencia: ${result.warning}` : 
                    `${type === 'cuenta' ? 'Número de cuenta' : 'CLABE'} validado correctamente`;
                className = result.warning ? 'warning' : 'success';
            } else {
                icon = 'fa-times-circle';
                message = result.error;
                className = 'error';
            }
        }
        
        item.className = `validation-item ${className}`;
        item.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    },

    // Show banking overall validation
    showBankingOverallValidation(status, message) {
        const overallDiv = document.getElementById('banking-overall-validation');
        if (overallDiv) {
            overallDiv.className = `overall-validation ${status}`;
            overallDiv.querySelector('.validation-message').textContent = message;
            overallDiv.style.display = 'block';
        }
    },

    // Enable/disable finish button
    enableFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.disabled = false;
        }
    },

    disableFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.disabled = true;
        }
    },

    // Reset banking data
    resetBanking() {
        this.initializeBankingData();
        
        const bankingStep = document.getElementById('banking-step');
        if (bankingStep) {
            const inputs = bankingStep.querySelectorAll('input');
            inputs.forEach(input => {
                if (!input.readOnly) {
                    input.value = '';
                }
            });
        }
    }
};