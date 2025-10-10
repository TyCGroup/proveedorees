// Form Handler for Supplier Registration - FLUJO NUEVO (SAT QR para CSF/Opinión)
class FormHandler {
    constructor() {
        this.uploadedFiles = {
            opinion: null,
            constancia: null,
            bancario: null
        };
        // NUEVO: URLs ya subidas (cuando ocr-processor hace uploadOnly)
        this.uploadedUrls = {
            opinion: null,
            constancia: null,
            bancario: null
        };

        this.validationStatus = {
            opinion: false,
            constancia: false,
            bancario: false,
            banking: false,
            commercial: false
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

        this.isManualReviewFlow = false;   // Flag flujo revisión manual
        this.forceManualReview = false;    // Candado cuando falla SAT pair
        this.pairFailureMsg = '';

        // Escuchar eventos del nuevo flujo
        window.addEventListener('fileUploaded', (e) => {
            const { docType, url } = e.detail || {};
            if (docType && url) {
                this.uploadedUrls[docType] = url;
                const v = document.getElementById(`${docType}-validation`);
                if (v && !v.classList.contains('success')) {
                    v.className = 'validation-status success';
                    v.innerHTML = `<i class="fas fa-check-circle"></i> Archivo subido correctamente`;
                    v.style.display = 'block';
                }
            }
        });

        window.addEventListener('satExtracted', (e) => {
            try {
                const { tipo, fields } = e.detail || {};
                console.log('[satExtracted]', tipo, fields);
            } catch {}
        });

        // Validación cruzada (pair) del backend
        window.addEventListener('satPairVerified', (e) => {
            const { rfc } = (e.detail || {});
            console.log('[satPairVerified] RFC validado:', rfc);
            this.forceManualReview = false;
            this.pairFailureMsg = '';
            this.showOverallValidation('success', `RFC validado contra SAT: ${rfc}`);
            this.checkOverallValidation(); // refresca botón al instante
        });

        window.addEventListener('satPairFailed', (e) => {
            const { reason, message } = (e.detail || {});
            console.warn('[satPairFailed]', reason, message);
            this.forceManualReview = true;
            this.pairFailureMsg = message || '';
            this.showOverallValidation('error', `Validación SAT rechazada (${reason}). ${message || ''}`);
            this.switchToManualReviewFlow();
            this.checkOverallValidation(); // asegura que el estado quede consistente
        });

        this.initializeEventListeners();
    }

    // ----------------- NUEVO: helpers de revalidación -----------------
    resetValidationFor(type) {
        // Limpia UI del documento cambiado
        const v = document.getElementById(`${type}-validation`);
        if (v) { v.className = 'validation-status'; v.style.display = 'none'; v.innerHTML = ''; }

        // Si cambian CSF u Opinión, hay que permitir reintentar el pair SAT
        if (type === 'opinion' || type === 'constancia') {
            this.forceManualReview = false;   // quitar candado al re-subir
            this.pairFailureMsg = '';
            // Limpia indicadores del ocrProcessor si existen
            if (window.ocrProcessor) {
                try {
                    if ('satPairVerified' in window.ocrProcessor) window.ocrProcessor.satPairVerified = null;
                    if (typeof window.ocrProcessor.clearPairState === 'function') window.ocrProcessor.clearPairState();
                } catch (e) { console.debug('No se pudo limpiar estado pair:', e); }
            }
        }

        // Feedback de revalidación
        const overall = document.getElementById('overall-validation');
        if (overall && overall.querySelector('.validation-message')) {
            overall.className = 'overall-validation info';
            overall.querySelector('.validation-message').textContent = 'Revalidando documentos...';
            overall.style.display = 'block';
        }

        // Botón siguiente deshabilitado mientras valida
        this.disableNextStep();
    }

    async revalidateAll(type) {
        // Reintentar pair SAT si el documento modificado es CSF u Opinión
        if (type === 'opinion' || type === 'constancia') {
            try {
                const pairFn =
                    window.ocrProcessor?.verifySatPair ||
                    window.ocrProcessor?.validatePair ||
                    window.ocrProcessor?.checkPair ||
                    null;
                if (typeof pairFn === 'function') {
                    await pairFn.call(window.ocrProcessor);
                }
            } catch (e) {
                console.warn('Error al reintentar SAT pair:', e);
            }
        }
        // Recalcula estado global
        this.checkOverallValidation();
    }
    // ------------------------------------------------------------------

    // Initialize event listeners
    initializeEventListeners() {
        const declarationCheckbox = document.getElementById('accept-declaration');
        if (declarationCheckbox) {
            declarationCheckbox.addEventListener('change', this.handleDeclarationChange.bind(this));
        }

        ['opinion', 'constancia', 'bancario'].forEach(type => {
            const fileInput = document.getElementById(`${type}-file`);
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileUpload(type, e.target));
            }
        });
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
                input.removeEventListener('input', this.handleBankingInput);
                input.removeEventListener('blur', this.validateBankingData);
                
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
        if (dataKey) this.bankingData[dataKey] = value;
        
        if (input.required) this.validateBankingForm();
    }

    validateBankingForm() {
        const numeroCuenta = document.getElementById('numero-cuenta').value;
        const clabe = document.getElementById('clabe').value;
        const telefonoCobranza = document.getElementById('telefono-cobranza').value;
        const requiredFieldsValid = numeroCuenta && clabe && telefonoCobranza;
        if (requiredFieldsValid) {
            this.validateBankingData();
        } else {
            this.disableBankingNextButton();
        }
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
    }

    async validateBankingData() {
        const numeroCuenta = document.getElementById('numero-cuenta').value;
        const clabe = document.getElementById('clabe').value;
        const telefonoCobranza = document.getElementById('telefono-cobranza').value;
        
        if (!numeroCuenta || !clabe || !telefonoCobranza) return;

        if (!this.validatePhoneNumber(telefonoCobranza)) {
            this.showBankingOverallValidation('error', 'El teléfono de cobranza debe tener un formato válido (10 dígitos mínimo).');
            this.validationStatus.banking = false;
            this.disableBankingNextButton();
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

    enableBankingNextButton() {
        const nextBtn = document.getElementById('banking-next-btn');
        if (nextBtn) nextBtn.disabled = false;
    }
    disableBankingNextButton() {
        const nextBtn = document.getElementById('banking-next-btn');
        if (nextBtn) nextBtn.disabled = true;
    }

    enableFinishButton() { this.enableBankingNextButton(); }
    disableFinishButton() { this.disableBankingNextButton(); }

    handleDeclarationChange(event) {
        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) continueBtn.disabled = !event.target.checked;
    }

    triggerFileUpload(type) {
        const fileInput = document.getElementById(`${type}-file`);
        if (fileInput) fileInput.click();
    }

    // ------- aquí forzamos revalidación en cada subida -------
    async handleFileUpload(type, input) {
        const file = input.files[0];
        if (!file) return;

        const validationResult = this.validateFile(file, type);
        if (!validationResult.valid) {
            this.showFileError(type, validationResult.error);
            input.value = '';
            return;
        }

        // Limpia estado y muestra "revalidando"
        this.resetValidationFor(type);
        this.showLoading();

        try {
            this.uploadedFiles[type] = file;
            this.showFileInfo(type, file);

            if (['opinion', 'constancia', 'bancario'].includes(type)) {
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

            this.updateUploadAreaAppearance(type, 'uploaded');
            await this.revalidateAll(type); // 🔁 siempre re-ejecuta validaciones

        } catch (error) {
            console.error('Error processing file:', error);
            this.showFileError(type, error.message || 'Error al procesar el archivo');
            this.updateUploadAreaAppearance(type, 'error');

            const msg = (error && (error.message || error.toString())) || '';
            if (error.reason || /69-?B/i.test(msg) || /RFC.*no coinciden/i.test(msg) || /no es POSITIVA/i.test(msg)) {
                this.forceManualReview = true;
                this.pairFailureMsg = msg;
                this.switchToManualReviewFlow();
            }
        } finally {
            this.hideLoading();
        }
    }
    // ---------------------------------------------------------

    validateFile(file) {
        if (file.type !== 'application/pdf') {
            return { valid: false, error: 'El archivo debe ser un PDF' };
        }
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            return { valid: false, error: 'El archivo no debe exceder 2MB' };
        }
        return { valid: true };
    }

    // ====== VALIDACIONES NUEVAS (no bloquear por fechas en SAT) ======
    validateOpinionDocument(data) {
        const errors = [];
        if (!data.companyName && window.ocrProcessor?.documentData?.constancia?.companyName) {
            data.companyName = window.ocrProcessor.documentData.constancia.companyName;
        }
        if ((data.sentiment || '').toUpperCase() !== 'POSITIVO') {
            errors.push('La opinión debe ser POSITIVA');
        }
        if (data.emissionDate) {
            const daysDiff = (new Date() - data.emissionDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 90) {
                const v = document.getElementById('opinion-validation');
                if (v) {
                    v.className = 'validation-status warning';
                    v.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Opinión positiva, pero con fecha antigua`;
                    v.style.display = 'block';
                }
            }
        }
        if (errors.length > 0) {
            this.showValidationStatus('opinion', 'error', errors.join('. '));
            this.validationStatus.opinion = false;
        } else {
            this.showValidationStatus('opinion', 'success', 'Opinión POSITIVA validada');
            this.validationStatus.opinion = true;
        }
    }

    validateConstanciaDocument(data) {
        const errors = [];
        if (!data.companyName) errors.push('No se pudo extraer la razón social');
        if (!data.rfc) errors.push('No se pudo extraer el RFC');

        if (data.emissionDate) {
            const daysDiff = (new Date() - data.emissionDate) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) {
                const v = document.getElementById('constancia-validation');
                if (v) {
                    v.className = 'validation-status warning';
                    v.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Constancia con antigüedad mayor a 30 días`;
                    v.style.display = 'block';
                }
            }
        }

        if (errors.length > 0) {
            this.showValidationStatus('constancia', 'error', errors.join('. '));
            this.validationStatus.constancia = false;
        } else {
            this.showValidationStatus('constancia', 'success', 'Constancia validada');
            this.validationStatus.constancia = true;
        }
    }

    validateBancarioDocument(data) {
        const errors = [];
        
        // 🔹 Para Document AI, NO validamos companyName aquí
        // Solo verificamos que tenga datos bancarios
        if (!data.cuenta && !data.clabe && !data.banco) {
            errors.push('No se pudieron extraer datos bancarios del documento');
        }
        
        // Si tiene datos, es válido
        if (errors.length > 0) {
            this.showValidationStatus('bancario', 'error', errors.join('. '));
            this.validationStatus.bancario = false;
        } else {
            // Mensaje más descriptivo según lo que se extrajo
            let message = 'Documento bancario procesado';
            if (data.ocrOk) {
                const extracted = [];
                if (data.cuenta) extracted.push('cuenta');
                if (data.clabe) extracted.push('CLABE');
                if (data.banco) extracted.push('banco');
                if (extracted.length > 0) {
                    message += ` (detectado: ${extracted.join(', ')})`;
                }
            }
            this.showValidationStatus('bancario', 'success', message);
            this.validationStatus.bancario = true;
        }
    }

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

    showFileError(type, error) {
        const validationDiv = document.getElementById(`${type}-validation`);
        if (validationDiv) {
            validationDiv.className = 'validation-status error';
            validationDiv.innerHTML = `<i class="fas fa-times-circle"></i> ${error}`;
            validationDiv.style.display = 'block';
        }
        this.updateUploadAreaAppearance(type, 'error');
    }

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

    updateUploadAreaAppearance(type, status) {
        const uploadDiv = document.querySelector(`#${type}-file`).closest('.document-upload');
        if (uploadDiv) {
            uploadDiv.className = `document-upload ${uploadDiv.classList.contains('required') ? 'required' : 'optional'} ${status}`;
        }
    }

    // =================== Overall validation ===================
    checkOverallValidation() {
        // Si hay candado activo por fallo SAT, mantener revisión manual
        if (this.forceManualReview) {
            const baseMsg = this.pairFailureMsg || 'Validación SAT rechazada. Continúe con Revisión manual.';
            this.showOverallValidation('error', baseMsg);
            this.switchToManualReviewFlow();
            return;
        }

        const hasRequiredFiles = this.uploadedFiles.opinion && 
                                 this.uploadedFiles.constancia && 
                                 this.uploadedFiles.bancario;
        const hasValidDocuments = this.validationStatus.opinion && 
                                  this.validationStatus.constancia && 
                                  this.validationStatus.bancario;

        if (hasRequiredFiles && hasValidDocuments) {
            const crossValidation = window.ocrProcessor.validateDocuments();
            const pairOK = window.ocrProcessor?.satPairVerified === true;

            if (pairOK &&
                crossValidation.companyNameMatch && 
                crossValidation.positiveOpinion && 
                crossValidation.dateValid) {
                this.showOverallValidation('success', 'Todos los documentos son válidos. Puede continuar al siguiente paso.');
                this.enableNextStep();
                this.switchToNormalFlow();
            } else {
                const errors = [];
                if (!pairOK) errors.push('Validación cruzada SAT (RFC/69-B) no superada');
                if (!crossValidation.companyNameMatch) errors.push('Los nombres de empresa no coinciden entre documentos');
                if (!crossValidation.positiveOpinion) errors.push('La opinión de cumplimiento debe ser POSITIVA');
                if (!crossValidation.dateValid) errors.push('La fecha de emisión de la constancia excede 30 días');
                this.showOverallValidation('error', `Errores encontrados: ${errors.join('. ')}`);
                this.switchToManualReviewFlow();
            }
        } else if (hasRequiredFiles) {
            this.switchToManualReviewFlow();
        } else {
            this.disableNextStep();
            this.switchToNormalFlow();
        }
    }

    switchToManualReviewFlow() {
        console.log('Cambiando a flujo de revisión manual...');
        this.isManualReviewFlow = true;
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.innerHTML = '<i class="fas fa-user"></i> Datos de Contacto';
            nextBtn.disabled = false;
            nextBtn.onclick = this.redirectToContactOnly.bind(this);
            nextBtn.classList.add('manual-review-btn');
            nextBtn.classList.remove('btn-primary');
            nextBtn.classList.add('btn-warning');
        }
        this.showManualReviewMessage();
        this.saveStateForContactOnly();
    }

    switchToNormalFlow() {
        console.log('Usando flujo normal de registro...');
        this.isManualReviewFlow = false;
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.innerHTML = 'Siguiente: Información de la Empresa <i class="fas fa-arrow-right"></i>';
            nextBtn.onclick = () => this.showCompanyInfo();
            nextBtn.classList.remove('manual-review-btn', 'btn-warning');
            nextBtn.classList.add('btn-primary');
        }
        this.hideManualReviewMessage();
    }

    showManualReviewMessage() {
        this.hideManualReviewMessage();
        const overallDiv = document.getElementById('overall-validation');
        if (overallDiv) {
            const messageDiv = document.createElement('div');
            messageDiv.id = 'manual-review-message';
            messageDiv.className = 'manual-review-notice';
            messageDiv.innerHTML = `
                <div class="manual-review-content">
                    <i class="fas fa-user-check"></i>
                    <div class="manual-review-text">
                        <h4>Revisión Manual Requerida</h4>
                        <p>Los documentos necesitan validación adicional por parte de nuestro equipo. Complete los datos de contacto para continuar con el proceso de revisión manual.</p>
                    </div>
                </div>
            `;
            this.addManualReviewStyles();
            overallDiv.parentNode.insertBefore(messageDiv, overallDiv.nextSibling);
        }
    }
    hideManualReviewMessage() { const m = document.getElementById('manual-review-message'); if (m) m.remove(); }
    addManualReviewStyles() {
        if (document.getElementById('manual-review-styles')) return;
        const styles = document.createElement('style');
        styles.id = 'manual-review-styles';
        styles.textContent = `
            .manual-review-notice { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; animation: slideInDown 0.3s ease-out; }
            .manual-review-content { display: flex; align-items: flex-start; gap: 1rem; }
            .manual-review-content i { color: #d97706; font-size: 1.5rem; margin-top: 0.25rem; flex-shrink: 0; }
            .manual-review-text h4 { margin: 0 0 0.5rem 0; color: #92400e; font-size: 1.1rem; font-weight: 600; }
            .manual-review-text p { margin: 0; color: #78350f; line-height: 1.5; font-size: 0.95rem; }
            .btn-warning { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; }
            .btn-warning:hover:not(:disabled) { background: linear-gradient(135deg, #d97706 0%, #b45309 100%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
            @keyframes slideInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(styles);
    }

    async saveStateForContactOnly() {
        try {
            const filesToSave = {};
            for (const [type, file] of Object.entries(this.uploadedFiles)) {
                if (file && file instanceof File) filesToSave[type] = await this.fileToSerializable(file);
            }
            sessionStorage.setItem('uploadedFiles', JSON.stringify(filesToSave));
            sessionStorage.setItem('uploadedUrls', JSON.stringify(this.uploadedUrls || {}));
            const companyInfo = window.ocrProcessor?.getCompanyInfo();
            if (companyInfo) sessionStorage.setItem('extractedCompanyInfo', JSON.stringify(companyInfo));
            const validationSummary = window.ocrProcessor?.getValidationSummary();
            if (validationSummary) sessionStorage.setItem('validationSummary', JSON.stringify(validationSummary));
        } catch (error) {
            console.error('Error guardando estado para contacto:', error);
            throw error;
        }
    }

    redirectToContactOnly() {
        console.log('Redirigiendo a formulario de contacto...');
        this.saveStateForContactOnly();
        window.location.href = '../view/contact-only.html';
    }

    showOverallValidation(status, message) {
        const overallDiv = document.getElementById('overall-validation');
        if (overallDiv) {
            overallDiv.className = `overall-validation ${status}`;
            overallDiv.querySelector('.validation-message').textContent = message;
            overallDiv.style.display = 'block';
        }
    }

    enableNextStep() {
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn && !nextBtn.classList.contains('manual-review-btn')) nextBtn.disabled = false;
    }
    disableNextStep() {
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn && !nextBtn.classList.contains('manual-review-btn')) nextBtn.disabled = true;
    }

    showCompanyInfo() {
        if (this.forceManualReview || window.ocrProcessor?.satPairVerified !== true) {
            this.switchToManualReviewFlow();
            const msg = this.pairFailureMsg || 'Validación SAT pendiente o rechazada. Continúe con Revisión manual.';
            this.showOverallValidation('error', msg);
            return;
        }
        const hasValidDocuments = this.validationStatus.opinion && this.validationStatus.constancia && this.validationStatus.bancario;
        if (!hasValidDocuments) return;
        this.fillCompanyForm();
        document.getElementById('documents-step').classList.remove('active');
        document.getElementById('company-step').classList.add('active');
        this.updateProgress(40, 'Paso 2 de 5: Información de la Empresa');
        this.currentStep = 'company';
    }

    showBankingInfo() {
        document.getElementById('company-step').classList.remove('active');
        document.getElementById('banking-step').classList.add('active');
        this.updateProgress(60, 'Paso 3 de 5: Información Bancaria');
        this.setupBankingListeners();
        this.currentStep = 'banking';
    }

    showContactInfo() {
        document.getElementById('banking-step').classList.remove('active');
        document.getElementById('contact-step').classList.add('active');
        this.updateProgress(80, 'Paso 4 de 5: Datos de Contacto');
        if (window.contactStepHandler) window.contactStepHandler.initializeContactStep();
        this.currentStep = 'contact';
    }

    showCommercialConditions() {
        document.getElementById('contact-step').classList.remove('active');
        document.getElementById('commercial-step').classList.add('active');
        this.updateProgress(100, 'Paso 5 de 5: Condiciones Comerciales');
        if (window.commercialConditionsHandler) window.commercialConditionsHandler.initializeCommercialStep();
        this.currentStep = 'commercial';
    }

    showDocuments() {
        if (this.currentStep === 'company') {
            document.getElementById('company-step').classList.remove('active');
            document.getElementById('documents-step').classList.add('active');
            this.updateProgress(20, 'Paso 1 de 5: Documentos');
            this.currentStep = 'documents';
        } else if (this.currentStep === 'banking') {
            document.getElementById('banking-step').classList.remove('active');
            document.getElementById('company-step').classList.add('active');
            this.updateProgress(40, 'Paso 2 de 5: Información de la Empresa');
            this.currentStep = 'company';
        } else if (this.currentStep === 'contact') {
            document.getElementById('contact-step').classList.remove('active');
            document.getElementById('banking-step').classList.add('active');
            this.updateProgress(60, 'Paso 3 de 5: Información Bancaria');
            this.currentStep = 'banking';
        } else if (this.currentStep === 'commercial') {
            document.getElementById('commercial-step').classList.remove('active');
            document.getElementById('contact-step').classList.add('active');
            this.updateProgress(80, 'Paso 4 de 5: Datos de Contacto');
            this.currentStep = 'contact';
        }
    }

    fillCompanyForm() {
        const companyInfo = window.ocrProcessor.getCompanyInfo();
        Object.keys(companyInfo).forEach(field => {
            const input = document.getElementById(this.mapFieldToId(field));
            if (input) input.value = companyInfo[field];
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

    updateProgress(percentage, text) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = text;
    }

    async submitForm() {
        try {
            this.showLoading();
            const formData = this.collectFormData();
            const fileUrls = await this.uploadFilesToStorage();
            await this.saveToFirestore(formData, fileUrls);
            this.showSuccessMessage();
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showErrorMessage(error.message || 'No se pudo enviar el formulario.');
        } finally {
            this.hideLoading();
        }
    }

    collectFormData() {
        const formData = {};
        
        const companyInputs = document.querySelectorAll('#company-step input');
        companyInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') formData[input.name] = input.value || '';
        });
        
        const bankingInputs = document.querySelectorAll('#banking-step input');
        bankingInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') formData[input.name] = input.value || '';
        });
        
        const contactInputs = document.querySelectorAll('#contact-step input');
        contactInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') {
                if (input.type === 'checkbox') {
                    if (!formData['areas']) formData['areas'] = [];
                    if (input.checked) formData['areas'].push(input.value);
                } else {
                    formData[input.name] = input.value || '';
                }
            }
        });
        
        const commercialInputs = document.querySelectorAll('#commercial-step input, #commercial-step select, #commercial-step textarea');
        commercialInputs.forEach(input => {
            if (input.name && input.name.trim() !== '') {
                if (input.type === 'checkbox') {
                    if (!formData['segmentos']) formData['segmentos'] = [];
                    if (input.checked) formData['segmentos'].push(input.value);
                } else {
                    formData[input.name] = input.value || '';
                }
            }
        });

        if (window.contactStepHandler) {
            const contactData = window.contactStepHandler.getContactData();
            if (contactData) formData.contactData = contactData;
        }

        if (window.commercialConditionsHandler) {
            const commercialData = window.commercialConditionsHandler.getCommercialData();
            if (commercialData) formData.commercialData = commercialData;
        }

        if (window.geographicHandler) {
            const geographicData = window.geographicHandler.getCoverageData();
            if (geographicData) formData.geographicData = geographicData;
        }
                
        formData.bankingData = { ...this.bankingData };
        formData.submissionDate = new Date().toISOString();
        formData.status = 'pending';
        formData.validationResults = window.ocrProcessor?.getValidationSummary?.() || (window.ocrProcessor?.validationResults || {});
        formData.bankingValidation = this.validationStatus.banking;
        formData.commercialValidation = this.validationStatus.commercial;
        formData.submissionType = this.isManualReviewFlow ? 'manual-review' : 'normal';

        Object.keys(formData).forEach(key => {
            if (key === '' || key.trim() === '') delete formData[key];
        });
        return formData;
    }

    async uploadFilesToStorage() {
        const storage = firebase.storage();
        const fileUrls = {};

        let submissionId = sessionStorage.getItem('submissionId');
        if (!submissionId) {
            submissionId = `sub-${Date.now()}`;
            sessionStorage.setItem('submissionId', submissionId);
        }

        const fileNameMapping = {
            opinion: '32D.pdf',
            constancia: 'CSF.pdf',
            bancario: 'EDO.CTA.pdf'
        };

        for (const [type, file] of Object.entries(this.uploadedFiles)) {
            if (!file) continue;
            const standardFileName = fileNameMapping[type] || `${type}.pdf`;
            const storageRef = storage.ref(`suppliers/${submissionId}/${standardFileName}`);
            const metadata = { contentType: 'application/pdf' };
            await storageRef.put(file, metadata);
            fileUrls[type] = await storageRef.getDownloadURL();
        }
        return fileUrls;
    }

    fileToSerializable(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const serializable = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    dataURL: e.target.result
                };
                resolve(serializable);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

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

    showSuccessMessage() {
        const formCard = document.querySelector('.form-card');
        formCard.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h2>¡Pre-registro Exitoso!</h2>
                <p>Su solicitud de pre-registro como proveedor ha sido enviada correctamente y será validada por el área de compras.</p>
                <p>Recibirá una notificación por correo electrónico sobre el estado de su solicitud.</p>
                <button class="btn btn-primary" onclick="window.open('https://www.tycgroup.com', '_blank')">
                    Visitar página T&C Group
                </button>
            </div>
        `;
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            Error: ${message}
        `;
        const formCard = document.querySelector('.form-card');
        formCard.insertBefore(errorDiv, formCard.firstChild);
        setTimeout(() => { errorDiv.remove(); }, 5000);
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
            loadingOverlay.addEventListener('click', this.preventModalClose);
            document.addEventListener('keydown', this.preventEscapeClose);
            document.body.style.overflow = 'hidden';
        }
    }
    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
            loadingOverlay.removeEventListener('click', this.preventModalClose);
            document.removeEventListener('keydown', this.preventEscapeClose);
            document.body.style.overflow = 'auto';
        }
    }
    preventModalClose(event) { event.preventDefault(); event.stopPropagation(); return false; }
    preventEscapeClose(event) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); return false; } }

    reset() {
        this.uploadedFiles = { opinion: null, constancia: null, bancario: null };
        this.uploadedUrls = { opinion: null, constancia: null, bancario: null };
        this.validationStatus = { opinion: false, constancia: false, bancario: false, banking: false, commercial: false };
        this.bankingData = {
            numeroCuenta: '', clabe: '', banco: '', sucursalBancaria: '',
            correoNotificaciones: '', telefonoCobranza: '', extension: '',
            swift: '', aba: '', iban: '', bic: '', convenioCie: ''
        };
        this.currentStep = 'documents';
        this.isManualReviewFlow = false;
        this.forceManualReview = false;
        this.pairFailureMsg = '';

        if (window.ocrProcessor) window.ocrProcessor.reset?.();
        window.contactStepHandler?.clearContactForm?.();
        window.commercialConditionsHandler?.clearCommercialForm?.();

        ['company-step', 'banking-step', 'contact-step', 'commercial-step'].forEach(stepId => {
            const step = document.getElementById(stepId);
            if (step) {
                const inputs = step.querySelectorAll('input');
                inputs.forEach(input => {
                    if (!input.readOnly) {
                        input.value = '';
                        if (input.type === 'checkbox') input.checked = false;
                    }
                });
            }
        });

        try {
            sessionStorage.removeItem('uploadedFiles');
            sessionStorage.removeItem('uploadedUrls');
            sessionStorage.removeItem('extractedCompanyInfo');
            sessionStorage.removeItem('validationSummary');
        } catch (error) {
            console.error('Error clearing sessionStorage:', error);
        }
    }
}

// Create global instance
window.formHandler = new FormHandler();

// Global functions para HTML
window.triggerFileUpload = (type) => window.formHandler.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler.handleFileUpload(type, input);
window.showCompanyInfo = () => window.formHandler.showCompanyInfo();
window.showBankingInfo = () => window.formHandler.showBankingInfo();
window.showContactInfo = () => window.formHandler.showContactInfo();
window.showCommercialConditions = () => window.formHandler.showCommercialConditions();
window.showDocuments = () => window.formHandler.showDocuments();
window.submitForm = () => window.formHandler.submitForm();

// Navegación con validación
window.proceedToCommercialConditions = () => {
    if (window.contactStepHandler && !window.contactStepHandler.validateAllContactFields()) {
        window.portalApp?.showErrorMessage('Por favor complete todos los campos requeridos del formulario de contacto.');
        return;
    }
    window.formHandler.showCommercialConditions();
};

window.proceedToSubmissionFromCommercial = () => {
    if (window.commercialConditionsHandler && !window.commercialConditionsHandler.validateAllCommercialFields()) {
        window.portalApp?.showErrorMessage('Por favor complete todos los campos requeridos del formulario de condiciones comerciales.');
        return;
    }
    window.formHandler.submitForm();
};
