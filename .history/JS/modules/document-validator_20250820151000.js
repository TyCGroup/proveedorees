// Document Validator Module
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
        try {
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
        } catch (error) {
            throw new Error(`Error al procesar ${type}: ${error.message}`);
        }
    }

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

    checkOverallValidation() {
        const hasRequiredFiles = this.uploadedFiles.opinion && 
                                this.uploadedFiles.constancia && 
                                this.uploadedFiles.bancario;
        
        const hasValidDocuments = this.validationStatus.opinion && 
                                 this.validationStatus.constancia && 
                                 this.validationStatus.bancario;

        if (hasRequiredFiles && hasValidDocuments) {
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
        if (nextBtn) {
            nextBtn.disabled = false;
        }
    }

    disableNextStep() {
        const nextBtn = document.getElementById('next-step-btn');
        if (nextBtn) {
            nextBtn.disabled = true;
        }
    }

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

    reset() {
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
}

// Export the class
export { DocumentValidator };