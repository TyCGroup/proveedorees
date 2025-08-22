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
            banking: false,
            commercial: false  // FALTA ESTO
        };
        this.currentStep = 'documents';
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

        // Banking form listeners will be setup when banking step is shown
        // Don't call setupBankingListeners() here as elements don't exist yet
    }

    // Setup banking form event listeners (called when banking step is shown)
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
                
                // En setupBankingListeners - AGREGAR VALIDACIÓN PARA TELÉFONO
                if (fieldId === 'numero-cuenta' || fieldId === 'clabe') {
                    // Special handling for main banking fields
                    if (fieldId === 'clabe') {
                        input.addEventListener('input', this.handleClabeInput.bind(this));
                    } else {
                        input.addEventListener('input', this.handleBankingInput.bind(this));
                    }
                    input.addEventListener('blur', this.validateBankingData.bind(this));
                } else if (fieldId === 'telefono-cobranza') {
                    // Special handling for required phone field
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                    input.addEventListener('blur', this.validateBankingForm.bind(this)); // USAR validateBankingForm en lugar de validateBankingData
                } else {
                    // Standard handling for other fields
                    input.addEventListener('input', this.handleGeneralBankingInput.bind(this));
                }
            }
        });
    }

    handleGeneralBankingInput(event) {
        const input = event.target;
        let value = input.value;
        
        // Mapear IDs de campos a propiedades del objeto bankingData
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
        
        // Validaciones específicas por campo
        switch (input.id) {
            case 'telefono-cobranza':
                // Solo números, espacios y guiones
                value = value.replace(/[^\d\s-]/g, '');
                break;
            case 'extension':
                // Solo números
                value = value.replace(/\D/g, '');
                break;
            case 'swift':
            case 'bic':
                // Convertir a mayúsculas
                value = value.toUpperCase();
                break;
            case 'aba':
                // Solo números para ABA
                value = value.replace(/\D/g, '');
                break;
            case 'iban':
                // Remover espacios y convertir a mayúsculas
                value = value.replace(/\s/g, '').toUpperCase();
                break;
            case 'convenio-cie':
                // Solo números y letras
                value = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                break;
        }
        
        input.value = value;
        
        // Actualizar bankingData
        const dataKey = fieldMapping[input.id];
        if (dataKey) {
            this.bankingData[dataKey] = value;
        }
        
        // Validar formulario si es campo requerido
        if (input.required) {
            this.validateBankingForm();
        }
    }

    // Nuevo método para validar el formulario bancario completo
    validateBankingForm() {
        const numeroCuenta = document.getElementById('numero-cuenta').value;
        const clabe = document.getElementById('clabe').value;
        const telefonoCobranza = document.getElementById('telefono-cobranza').value;
        
        // Verificar campos requeridos
        const requiredFieldsValid = numeroCuenta && clabe && telefonoCobranza;
        
        if (requiredFieldsValid) {
            // Si los campos requeridos están llenos, validar con OCR
            this.validateBankingData();
        } else {
            // Deshabilitar botón si faltan campos requeridos
            this.disableBankingNextButton();
        }
    }

    // Handle banking input (números de cuenta)
    handleBankingInput(event) {
        const input = event.target;
        // Remove non-numeric characters
        let value = input.value.replace(/\D/g, '');
        
        if (input.id === 'numero-cuenta') {
            // Limit to 20 characters for account number
            value = value.slice(0, 20);
            this.bankingData.numeroCuenta = value; // USAR LA PROPIEDAD CORRECTA
        }
        
        input.value = value;
    }

    

    // Handle CLABE input with formatting
    handleClabeInput(event) {
        const input = event.target;
        let value = input.value.replace(/\D/g, '');
        
        // Limit to 18 digits
        value = value.slice(0, 18);
        
        input.value = value;
        this.bankingData.clabe = value; // ESTO YA ESTÁ CORRECTO
        
        // Visual feedback for CLABE format
        const isValid = value.length === 18;
        input.classList.toggle('valid', isValid);
        input.classList.toggle('invalid', value.length > 0 && !isValid);
    }

    // Validate banking data against OCR
    async validateBankingData() {
        const numeroCuenta = document.getElementById('numero-cuenta').value;
        const clabe = document.getElementById('clabe').value;
        const telefonoCobranza = document.getElementById('telefono-cobranza').value;
        
        // Verificar que todos los campos requeridos estén presentes
        if (!numeroCuenta || !clabe || !telefonoCobranza) {
            return;
        }

        // Validar formato de teléfono
        if (!this.validatePhoneNumber(telefonoCobranza)) {
            this.showBankingOverallValidation('error', 'El teléfono de cobranza debe tener un formato válido (10 dígitos mínimo).');
            this.validationStatus.banking = false;
            this.disableBankingNextButton();
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
                this.enableBankingNextButton();
            } else {
                this.showBankingOverallValidation('error', `Errores en validación: ${validation.errors.join('. ')}`);
                this.validationStatus.banking = false;
                this.disableBankingNextButton();
            }
            
        } catch (error) {
            console.error('Error validating banking data:', error);
            this.showBankingOverallValidation('error', 'Error al validar la información bancaria.');
            this.validationStatus.banking = false;
            this.disableBankingNextButton();
        }
    }

    validatePhoneNumber(phone) {
        // Remover espacios y guiones
        const cleanPhone = phone.replace(/[\s-]/g, '');
        // Verificar que tenga al menos 10 dígitos
        return /^\d{10,}$/.test(cleanPhone);
    }

    // Show banking validation results section
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

    // Update individual banking validation item
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

    // Show banking overall validation
    showBankingOverallValidation(status, message) {
        const overallDiv = document.getElementById('banking-overall-validation');
        if (overallDiv) {
            overallDiv.className = `overall-validation ${status}`;
            overallDiv.querySelector('.validation-message').textContent = message;
            overallDiv.style.display = 'block';
        }
    }

    // Enable banking next button (ACTUALIZADO)
    enableBankingNextButton() {
        const nextBtn = document.getElementById('banking-next-btn');
        if (nextBtn) {
            nextBtn.disabled = false;
        }
    }

    // Disable banking next button (ACTUALIZADO)
    disableBankingNextButton() {
        const nextBtn = document.getElementById('banking-next-btn');
        if (nextBtn) {
            nextBtn.disabled = true;
        }
    }

    // Legacy methods for compatibility (ACTUALIZADOS)
    enableFinishButton() {
        this.enableBankingNextButton();
    }

    disableFinishButton() {
        this.disableBankingNextButton();
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
        
        // Update progress - ACTUALIZADO para 4 pasos
        this.updateProgress(40, 'Paso 2 de 5: Información de la Empresa');
        
        this.currentStep = 'company';
    }

    // Show banking information step
    showBankingInfo() {
        // Switch to banking step
        document.getElementById('company-step').classList.remove('active');
        document.getElementById('banking-step').classList.add('active');
        
        // Update progress - ACTUALIZADO para 4 pasos
        this.updateProgress(60, 'Paso 3 de 5: Información Bancaria');
        
        // Setup banking listeners now that elements exist
        this.setupBankingListeners();
        
        this.currentStep = 'banking';
    }

    // Show contact information step (NUEVO)
    showContactInfo() {
        // Switch to contact step
        document.getElementById('banking-step').classList.remove('active');
        document.getElementById('contact-step').classList.add('active');
        
        // Update progress
        this.updateProgress(80, 'Paso 4 de 5: Datos de Contacto');
        
        // Initialize contact step if handler exists
        if (window.contactStepHandler) {
            window.contactStepHandler.initializeContactStep();
        }
        
        this.currentStep = 'contact';
    }

    // AGREGAR ESTE MÉTODO:
    showCommercialConditions() {
        // Switch to commercial step
        document.getElementById('contact-step').classList.remove('active');
        document.getElementById('commercial-step').classList.add('active');
        
        // Update progress
        this.updateProgress(100, 'Paso 5 de 5: Condiciones Comerciales');
        
        // Initialize commercial step if handler exists
        if (window.commercialConditionsHandler) {
            window.commercialConditionsHandler.initializeCommercialStep();
        }
        
        this.currentStep = 'commercial';
    }

    // Show documents step - ACTUALIZADO: Lógica de navegación para 4 pasos
    showDocuments() {
        if (this.currentStep === 'company') {
            document.getElementById('company-step').classList.remove('active');
            document.getElementById('documents-step').classList.add('active');
            this.updateProgress(20, 'Paso 1 de 5: Documentos'); // Era 25, 'Paso 1 de 4'
            this.currentStep = 'documents';
        } else if (this.currentStep === 'banking') {
            document.getElementById('banking-step').classList.remove('active');
            document.getElementById('company-step').classList.add('active');
            this.updateProgress(40, 'Paso 2 de 5: Información de la Empresa'); // Era 50, 'Paso 2 de 4'
            this.currentStep = 'company';
        } else if (this.currentStep === 'contact') {
            document.getElementById('contact-step').classList.remove('active');
            document.getElementById('banking-step').classList.add('active');
            this.updateProgress(60, 'Paso 3 de 5: Información Bancaria'); // Era 75, 'Paso 3 de 4'
            this.currentStep = 'banking';
        } else if (this.currentStep === 'commercial') { // AGREGAR ESTE BLOQUE
            document.getElementById('commercial-step').classList.remove('active');
            document.getElementById('contact-step').classList.add('active');
            this.updateProgress(80, 'Paso 4 de 5: Datos de Contacto');
            this.currentStep = 'contact';
        }
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

    // Collect form data - ACTUALIZADO para incluir datos de contacto
    collectFormData() {
        const formData = {};
        
        // Get company form inputs
        const companyInputs = document.querySelectorAll('#company-step input');
        companyInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') {  // Verificar que name existe y no está vacío
                formData[input.name] = input.value || '';
            }
        });
        
        // Get banking form inputs
        const bankingInputs = document.querySelectorAll('#banking-step input');
        bankingInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') {  // Verificar que name existe y no está vacío
                formData[input.name] = input.value || '';
            }
        });
        
        // Get contact form inputs
        const contactInputs = document.querySelectorAll('#contact-step input');
        contactInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') {  // Verificar que name existe y no está vacío
                if (input.type === 'checkbox') {
                    if (!formData['areas']) formData['areas'] = [];
                    if (input.checked) {
                        formData['areas'].push(input.value);
                    }
                } else {
                    formData[input.name] = input.value || '';
                }
            }
        });
        
        // Get commercial form inputs
        const commercialInputs = document.querySelectorAll('#commercial-step input, #commercial-step select, #commercial-step textarea');
        commercialInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') {  // Verificar que name existe y no está vacío
                if (input.type === 'checkbox') {
                    if (!formData['segmentos']) formData['segmentos'] = [];
                    if (input.checked) {
                        formData['segmentos'].push(input.value);
                    }
                } else {
                    formData[input.name] = input.value || '';
                }
            }
        });

        // Add contact data if handler exists
        if (window.contactStepHandler) {
            const contactData = window.contactStepHandler.getContactData();
            if (contactData) {
                formData.contactData = contactData;
            }
        }

        // Add commercial data if handler exists
        if (window.commercialConditionsHandler) {
            const commercialData = window.commercialConditionsHandler.getCommercialData();
            if (commercialData) {
                formData.commercialData = commercialData;
            }
        }

        // Add geographic data if handler exists
        if (window.geographicHandler) {
            const geographicData = window.geographicHandler.getCoverageData();
            if (geographicData) {
                formData.geographicData = geographicData;
            }
        }
                
        // Agregar datos bancarios del objeto interno
        formData.bankingData = { ...this.bankingData };
        
        // Add metadata
        formData.submissionDate = new Date().toISOString();
        formData.status = 'pending';
        formData.validationResults = window.ocrProcessor?.validationResults || {};
        formData.bankingValidation = this.validationStatus.banking;
        formData.commercialValidation = this.validationStatus.commercial;
        
        // Remove any empty string keys that might have been created
        Object.keys(formData).forEach(key => {
            if (key === '' || key.trim() === '') {
                delete formData[key];
            }
        });
        
        return formData;
    }

    // Upload files to Firebase Storage
    async uploadFilesToStorage() {
        const storage = firebase.storage();
        const fileUrls = {};
        
        // Create unique folder for this submission
        const submissionId = Date.now().toString();
        
        // Map file types to standard names
        const fileNameMapping = {
            'opinion': '32D.pdf',
            'constancia': 'CSF.pdf', 
            'bancario': 'EDO.CTA.pdf'
        };
        
        // Upload each file with standard name
        for (const [type, file] of Object.entries(this.uploadedFiles)) {
            if (file) {
                const standardFileName = fileNameMapping[type] || `${type}.pdf`;
                const storageRef = storage.ref(`suppliers/${submissionId}/${standardFileName}`);
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
                <h2>¡Pre-registro Exitoso!</h2>
                <p>Su solicitud de pre-registro como proveedor ha sido enviada correctamente y sera validad por el área de compras.</p>
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
            
            // Prevenir cierre del modal con clic o tecla Escape
            loadingOverlay.addEventListener('click', this.preventModalClose);
            document.addEventListener('keydown', this.preventEscapeClose);
            
            // Deshabilitar scroll del body
            document.body.style.overflow = 'hidden';
        }
    }

    // Hide loading overlay
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
            
            // Remover event listeners de prevención
            loadingOverlay.removeEventListener('click', this.preventModalClose);
            document.removeEventListener('keydown', this.preventEscapeClose);
            
            // Rehabilitar scroll del body
            document.body.style.overflow = 'auto';
        }
    }

    preventModalClose(event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    // Función para prevenir cierre con tecla Escape
    preventEscapeClose(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }

        preventModalClose(event) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    // Función para prevenir cierre con tecla Escape
    preventEscapeClose(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }

    // Reset form - ACTUALIZADO para incluir paso de contacto
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
            banking: false,
            commercial: false  // FALTA ESTO
        };
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
        this.currentStep = 'documents';
        
        // Reset OCR processor
        if (window.ocrProcessor) {
            window.ocrProcessor.reset();
        }
        
        // Reset contact step if handler exists (NUEVO)
        if (window.contactStepHandler) {
            window.contactStepHandler.clearContactForm();
        }

        if (window.commercialConditionsHandler) {
            window.commercialConditionsHandler.clearCommercialForm();
        }
        
        // Clear forms - TODOS los campos incluyendo contacto
        ['company-step', 'banking-step', 'contact-step', 'commercial-step'].forEach(stepId => {
            const step = document.getElementById(stepId);
            if (step) {
                const inputs = step.querySelectorAll('input');
                inputs.forEach(input => {
                    if (!input.readOnly) {
                        input.value = '';
                        if (input.type === 'checkbox') {
                            input.checked = false;
                        }
                    }
                });
            }
        });
    }
}

// Create global instance
window.formHandler = new FormHandler();

// Global functions for HTML onclick events - ACTUALIZADAS
window.triggerFileUpload = (type) => window.formHandler.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler.handleFileUpload(type, input);
window.showCompanyInfo = () => window.formHandler.showCompanyInfo();
window.showBankingInfo = () => window.formHandler.showBankingInfo();
window.showContactInfo = () => window.formHandler.showContactInfo(); // NUEVO
window.showCommercialConditions = () => window.formHandler.showCommercialConditions();
window.showDocuments = () => window.formHandler.showDocuments();
window.submitForm = () => window.formHandler.submitForm();

// CORREGIR estas funciones:
window.proceedToCommercialConditions = () => {
    if (window.contactStepHandler && !window.contactStepHandler.validateAllContactFields()) {
        // AGREGAR mensaje de error:
        alert('Por favor complete todos los campos requeridos del formulario de contacto.');
        return;
    }
    window.formHandler.showCommercialConditions();
};

window.proceedToSubmissionFromCommercial = () => {
    if (window.commercialConditionsHandler && !window.commercialConditionsHandler.validateAllCommercialFields()) {
        // AGREGAR mensaje de error:
        alert('Por favor complete todos los campos requeridos del formulario de condiciones comerciales.');
        return;
    }
    window.formHandler.submitForm();
};