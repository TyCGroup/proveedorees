// Form Handler for Supplier Registration
class FormHandler {
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
        banking: false // Nuevo estado para validación bancaria
    };
    this.currentStep = 'documents';
    this.bankingData = {
        numeroCuenta: '',
        clabe: '',
        banco: ''
    };
    this.initializeEventListeners();
}

    // Initialize event listeners
initializeEventListeners() {
    // Declaration checkbox
    const declarationCheckbox = document.getElementById('accept-declaration');
    if (declarationCheckbox) {
        declarationCheckbox.addEventListener('change', this.handleDeclarationChange.bind(this));
    }

    // File input change listeners
    ['opinion', 'constancia', 'bancario'].forEach(type => {
        const fileInput = document.getElementById(`${type}-file`);
        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileUpload(type, e.target));
        }
    });

    // Banking form listeners
    this.setupBankingListeners();
}

setupBankingListeners() {
    const numeroCuentaInput = document.getElementById('numero-cuenta');
    const clabeInput = document.getElementById('clabe');

    if (numeroCuentaInput) {
        numeroCuentaInput.addEventListener('input', this.handleBankingInput.bind(this));
        numeroCuentaInput.addEventListener('blur', this.validateBankingData.bind(this));
    }

    if (clabeInput) {
        clabeInput.addEventListener('input', this.handleClabeInput.bind(this));
        clabeInput.addEventListener('blur', this.validateBankingData.bind(this));
    }
}

handleClabeInput(event) {
    const input = event.target;
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 18 digits
    value = value.slice(0, 18);
    
    input.value = value;
    this.bankingData.clabe = value;
    
    // Visual feedback for CLABE format
    const isValid = value.length === 18;
    input.classList.toggle('valid', isValid);
    input.classList.toggle('invalid', value.length > 0 && !isValid);
}

async validateBankingData() {
    const numeroCuenta = document.getElementById('numero-cuenta').value;
    const clabe = document.getElementById('clabe').value;
    
    if (!numeroCuenta || !clabe) {
        return;
    }

    this.showBankingValidationResults();
    
    try {
        // Perform OCR validation
        const validation = window.ocrProcessor.validateBankingInfo(numeroCuenta, clabe);
        
        this.updateBankingValidation('cuenta', validation.details.numeroCuenta);
        this.updateBankingValidation('clabe', validation.details.clabe);
        this.updateBankingValidation('banco', { valid: !!validation.bankName, bankName: validation.bankName });
        
        // Fill bank name if detected
        if (validation.bankName) {
            document.getElementById('banco').value = validation.bankName;
            this.bankingData.banco = validation.bankName;
        }
        
        // Update overall validation
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

showBankingOverallValidation(status, message) {
    const overallDiv = document.getElementById('banking-overall-validation');
    if (overallDiv) {
        overallDiv.className = `overall-validation ${status}`;
        overallDiv.querySelector('.validation-message').textContent = message;
        overallDiv.style.display = 'block';
    }
}

// Enable finish button
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

showBankingValidationResults() {
    const resultsDiv = document.getElementById('banking-validation-results');
    if (resultsDiv) {
        resultsDiv.style.display = 'block';
        
        // Reset all validation items to validating state
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


handleBankingInput(event) {
    const input = event.target;
    // Remove non-numeric characters
    let value = input.value.replace(/\D/g, '');
    
    if (input.id === 'numero-cuenta') {
        // Limit to 20 characters for account number
        value = value.slice(0, 20);
    }
    
    input.value = value;
    this.bankingData[input.name] = value;
}

    // Handle declaration checkbox change
    handleDeclarationChange(event) {
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.disabled = !event.target.checked;
        }
    }

    // Trigger file upload
    triggerFileUpload(type) {
        const fileInput = document.getElementById(`${type}-file`);
        if (fileInput) {
            fileInput.click();
        }
    }

    // Handle file upload
    async handleFileUpload(type, input) {
        const file = input.files[0];
        if (!file) return;

        // Validate file
        const validationResult = this.validateFile(file, type);
        if (!validationResult.valid) {
            this.showFileError(type, validationResult.error);
            input.value = '';
            return;
        }

        // Show loading
        this.showLoading();

        try {
            // Store file
            this.uploadedFiles[type] = file;
            
            // Show file info
            this.showFileInfo(type, file);
            
            // Process required documents with OCR
            if (['opinion', 'constancia', 'bancario'].includes(type)) {
                await this.processDocumentWithOCR(type, file);
            }

            // Update upload area appearance
            this.updateUploadAreaAppearance(type, 'uploaded');
            
            // Check if all validations pass
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

    // Validate uploaded file
    validateFile(file, type) {
        // Check file type
        if (file.type !== 'application/pdf') {
            return {
                valid: false,
                error: 'El archivo debe ser un PDF'
            };
        }

        // Check file size (2MB max)
        const maxSize = 2 * 1024 * 1024; // 2MB in bytes
        if (file.size > maxSize) {
            return {
                valid: false,
                error: 'El archivo no debe exceder 2MB'
            };
        }

        return { valid: true };
    }

    // Process document with OCR
    async processDocumentWithOCR(type, file) {
        try {
            const extractedData = await window.ocrProcessor.processPDF(file, type);
            
            // Validate specific requirements for each document type
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

        } catch (error) {
            throw new Error(`Error al procesar ${type}: ${error.message}`);
        }
    }

    // Validate opinion document
    validateOpinionDocument(data) {
        const errors = [];
        
        if (!data.companyName) {
            errors.push('No se pudo extraer el nombre de la empresa');
        }
        
        if (data.sentiment !== 'POSITIVO') {
            errors.push('La opinión debe ser POSITIVA');
        }
        
        if (!data.emissionDate) {
            errors.push('No se pudo extraer la fecha de emisión');
        } else {
            const daysDiff = (new Date() - data.emissionDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) {
                errors.push('La fecha de emisión debe ser menor a 30 días');
            }
        }

        if (errors.length > 0) {
            this.showValidationStatus('opinion', 'error', errors.join('. '));
            this.validationStatus.opinion = false;
        } else {
            this.showValidationStatus('opinion', 'success', 'Documento válido');
            this.validationStatus.opinion = true;
        }
    }

    // Validate constancia document
    validateConstanciaDocument(data) {
        const errors = [];
        
        if (!data.companyName) {
            errors.push('No se pudo extraer el nombre de la empresa');
        }
        
        if (!data.rfc) {
            errors.push('No se pudo extraer el RFC');
        }
        
        if (!data.emissionDate) {
            errors.push('No se pudo extraer la fecha de emisión');
        } else {
            const daysDiff = (new Date() - data.emissionDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) {
                errors.push('La fecha de emisión debe ser menor a 30 días');
            }
        }

        if (errors.length > 0) {
            this.showValidationStatus('constancia', 'error', errors.join('. '));
            this.validationStatus.constancia = false;
        } else {
            this.showValidationStatus('constancia', 'success', 'Documento válido');
            this.validationStatus.constancia = true;
        }
    }

    // Validate bancario document
    validateBancarioDocument(data) {
        const errors = [];
        
        if (!data.companyName) {
            errors.push('No se pudo extraer el nombre de la empresa');
        }

        if (errors.length > 0) {
            this.showValidationStatus('bancario', 'error', errors.join('. '));
            this.validationStatus.bancario = false;
        } else {
            this.showValidationStatus('bancario', 'success', 'Documento válido');
            this.validationStatus.bancario = true;
        }
    }

    // Show file information
    showFileInfo(type, file) {
        const fileInfoDiv = document.getElementById(`${type}-info`);
        if (fileInfoDiv) {
            const fileName = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            
            fileInfoDiv.innerHTML = `
                <div class="file-name">${fileName}</div>
                <div class="file-size">${fileSize} MB</div>
            `;
            fileInfoDiv.style.display = 'block';
        }
    }

    // Show file error
    showFileError(type, error) {
        const validationDiv = document.getElementById(`${type}-validation`);
        if (validationDiv) {
            validationDiv.className = 'validation-status error';
            validationDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${error}`;
            validationDiv.style.display = 'block';
        }
        
        this.updateUploadAreaAppearance(type, 'error');
    }

    // Show validation status
    showValidationStatus(type, status, message) {
        const validationDiv = document.getElementById(`${type}-validation`);
        if (validationDiv) {
            const icon = status === 'success' ? 'fa-check-circle' : 
                        status === 'error' ? 'fa-times-circle' : 'fa-exclamation-triangle';
            
            validationDiv.className = `validation-status ${status}`;
            validationDiv.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
            validationDiv.style.display = 'block';
        }
    }

    // Update upload area appearance
    updateUploadAreaAppearance(type, status) {
        const uploadDiv = document.querySelector(`#${type}-file`).closest('.document-upload');
        if (uploadDiv) {
            uploadDiv.className = `document-upload ${uploadDiv.classList.contains('required') ? 'required' : 'optional'} ${status}`;
        }
    }

    // Check overall validation
    checkOverallValidation() {
        const hasRequiredFiles = this.uploadedFiles.opinion && 
                                this.uploadedFiles.constancia && 
                                this.uploadedFiles.bancario;
        
        const hasValidDocuments = this.validationStatus.opinion && 
                                 this.validationStatus.constancia && 
                                 this.validationStatus.bancario;

        if (hasRequiredFiles && hasValidDocuments) {
            // Perform cross-document validation
            const crossValidation = window.ocrProcessor.validateDocuments();
            
            if (crossValidation.companyNameMatch && 
                crossValidation.positiveOpinion && 
                crossValidation.dateValid) {
                
                this.showOverallValidation('success', 'Todos los documentos son válidos. Puede continuar al siguiente paso.');
                this.enableNextStep();
                
            } else {
                const errors = [];
                if (!crossValidation.companyNameMatch) {
                    errors.push('Los nombres de empresa no coinciden entre documentos');
                }
                if (!crossValidation.positiveOpinion) {
                    errors.push('La opinión de cumplimiento debe ser POSITIVA');
                }
                if (!crossValidation.dateValid) {
                    errors.push('La fecha de emisión de la constancia excede 30 días');
                }
                
                this.showOverallValidation('error', `Errores encontrados: ${errors.join('. ')}`);
                this.disableNextStep();
            }
        } else {
            this.disableNextStep();
        }
    }

    // Show overall validation message
    showOverallValidation(status, message) {
        const overallDiv = document.getElementById('overall-validation');
        if (overallDiv) {
            overallDiv.className = `overall-validation ${status}`;
            overallDiv.querySelector('.validation-message').textContent = message;
            overallDiv.style.display = 'block';
        }
    }

    // Enable next step
    enableNextStep() {
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.disabled = false;
        }
    }

    // Disable next step
    disableNextStep() {
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.disabled = true;
        }
    }

    // Show company information step
showCompanyInfo() {
    // Fill form with extracted data
    this.fillCompanyForm();
    
    // Switch to company step
    document.getElementById('documents-step').classList.remove('active');
    document.getElementById('company-step').classList.add('active');
    
    // Update progress
    this.updateProgress(66, 'Paso 2 de 3: Información de la Empresa');
    
    this.currentStep = 'company';
}

showBankingInfo() {
    // Switch to banking step
    document.getElementById('company-step').classList.remove('active');
    document.getElementById('banking-step').classList.add('active');
    
    // Update progress
    this.updateProgress(100, 'Paso 3 de 3: Información Bancaria');
    
    // Setup banking listeners if not already done
    this.setupBankingListeners();
    
    this.currentStep = 'banking';
}


    // Fill company form with OCR data
    fillCompanyForm() {
        const companyInfo = window.ocrProcessor.getCompanyInfo();
        
        // Fill form fields
        Object.keys(companyInfo).forEach(field => {
            const input = document.getElementById(this.mapFieldToId(field));
            if (input) {
                input.value = companyInfo[field];
            }
        });
    }

    // Map field names to form IDs
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

    // Show documents step
showDocuments() {
    if (this.currentStep === 'company') {
        document.getElementById('company-step').classList.remove('active');
        document.getElementById('documents-step').classList.add('active');
        this.updateProgress(33, 'Paso 1 de 3: Documentos');
    } else if (this.currentStep === 'banking') {
        document.getElementById('banking-step').classList.remove('active');
        document.getElementById('company-step').classList.add('active');
        this.updateProgress(66, 'Paso 2 de 3: Información de la Empresa');
    }
    
    this.currentStep = this.currentStep === 'banking' ? 'company' : 'documents';
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

    // Submit form
    async submitForm() {
        try {
            this.showLoading();
            
            // Collect form data
            const formData = this.collectFormData();
            
            // Upload files to Firebase Storage
            const fileUrls = await this.uploadFilesToStorage();
            
            // Save data to Firestore
            await this.saveToFirestore(formData, fileUrls);
            
            // Show success message
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Collect form data
collectFormData() {
    const formData = {};
    
    // Get company form inputs
    const companyInputs = document.querySelectorAll('#company-step input');
    companyInputs.forEach(input => {
        formData[input.name] = input.value;
    });
    
    // Get banking form inputs
    const bankingInputs = document.querySelectorAll('#banking-step input');
    bankingInputs.forEach(input => {
        formData[input.name] = input.value;
    });
    
    // Add metadata
    formData.submissionDate = new Date().toISOString();
    formData.status = 'pending';
    formData.validationResults = window.ocrProcessor.validationResults;
    formData.bankingValidation = this.validationStatus.banking;
    
    return formData;
}

    // Upload files to Firebase Storage
    async uploadFilesToStorage() {
        const storage = firebase.storage();
        const fileUrls = {};
        
        // Create unique folder for this submission
        const submissionId = Date.now().toString();
        
        // Upload each file
        for (const [type, file] of Object.entries(this.uploadedFiles)) {
            if (file) {
                const storageRef = storage.ref(`suppliers/${submissionId}/${type}_${file.name}`);
                await storageRef.put(file);
                fileUrls[type] = await storageRef.getDownloadURL();
            }
        }
        
        return fileUrls;
    }

    // Save to Firestore
    async saveToFirestore(formData, fileUrls) {
        const db = window.firebaseDB;
        
        const supplierData = {
            ...formData,
            files: fileUrls,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('suppliers').add(supplierData);
    }

    // Show success message
    showSuccessMessage() {
        const formCard = document.querySelector('.form-card');
        formCard.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h2>¡Registro Exitoso!</h2>
                <p>Su solicitud de registro como proveedor ha sido enviada correctamente.</p>
                <p>Recibirá una notificación por correo electrónico sobre el estado de su solicitud.</p>
                <button class="btn btn-primary" onclick="location.reload()">
                    Realizar Otro Registro
                </button>
            </div>
        `;
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
        
        // Remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // Show loading overlay
    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
        }
    }

    // Hide loading overlay
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
        }
    }

    // Reset form
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
    this.bankingData = {
        numeroCuenta: '',
        clabe: '',
        banco: ''
    };
    this.currentStep = 'documents';
    
    // Reset OCR processor
    window.ocrProcessor.reset();
    
    // Clear forms
    ['company-step', 'banking-step'].forEach(stepId => {
        const step = document.getElementById(stepId);
        if (step) {
            const inputs = step.querySelectorAll('input');
            inputs.forEach(input => {
                if (!input.readOnly) {
                    input.value = '';
                }
            });
        }
    });
}
}

// Create global instance
window.formHandler = new FormHandler();

// Global functions for HTML onclick events
window.triggerFileUpload = (type) => window.formHandler.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler.handleFileUpload(type, input);
window.showCompanyInfo = () => window.formHandler.showCompanyInfo();
window.showDocuments = () => window.formHandler.showDocuments();
window.submitForm = () => window.formHandler.submitForm();