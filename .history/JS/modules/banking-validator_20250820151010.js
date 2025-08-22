// Banking Validator Module
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
                // Remove existing listeners to avoid duplicates
                input.removeEventListener('input', this.handleBankingInput);
                input.removeEventListener('blur', this.validateBankingData);
                
                if (fieldId === 'clabe') {
                    input.addEventListener('input', this.handleClabeInput.bind(this));
                } else if (fieldId === 'numero-cuenta') {
                    input.addEventListener('input', this.handleBankingInput.bind(this));
                    input.addEventListener('blur', this.validateBankingData.bind(this));
                } else if (fieldId === 'telefono-cobranza') {
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                    input.addEventListener('blur', this.validateBankingForm.bind(this));
                } else {
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                }
            }
        });
    }

    handleBankingInput(event) {
        const input = event.target;
        let value = input.value.replace(/\D/g, '');
        
        if (input.id === 'numero-cuenta') {
            value = value.slice(0, 20);
            this.bankingData.numeroCuenta = value;
        }
        
        input.value = value;
    }

    handleClabeInput(event) {
        const input = event.target;
        let value = input.value.replace(/\D/g, '');
        
        value = value.slice(0, 18);
        
        input.value = value;
        this.bankingData.clabe = value;
        
        const isValid = value.length === 18;
        input.classList.toggle('valid', isValid);
        input.classList.toggle('invalid', value.length > 0 && !isValid);
        
        if (isValid) {
            this.validateBankingData();
        }
    }

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
            this.bankingData[dataKey] = value;
        }
        
        if (input.required) {
            this.validateBankingForm();
        }
    }

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
    }

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
                this.bankingData.banco = validation.bankName;
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
    }

    validatePhoneNumber(phone) {
        const cleanPhone = phone.replace(/[\s-]/g, '');
        return /^\d{10,}$/.test(cleanPhone);
    }

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
    }

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
    }

    showBankingOverallValidation(status, message) {
        const overallDiv = document.getElementById('banking-overall-validation');
        if (overallDiv) {
            overallDiv.className = `overall-validation ${status}`;
            overallDiv.querySelector('.validation-message').textContent = message;
            overallDiv.style.display = 'block';
        }
    }

    enableFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.disabled = false;
        }
    }

    disableFinishButton() {
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.disabled = true;
        }
    }

    isValid() {
        return this.validationStatus.banking;
    }

    getFormData() {
        return { ...this.bankingData };
    }

    reset() {
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
}

// Export the class
export { BankingValidator };