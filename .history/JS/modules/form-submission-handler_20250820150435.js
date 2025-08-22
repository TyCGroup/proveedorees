// Form Submission Handler Module
export class FormSubmissionHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.submissionInProgress = false;
    }

    initialize() {
        // Setup submission event listeners
        this.setupSubmissionListeners();
    }

    setupSubmissionListeners() {
        // Final submit button
        const submitBtn = document.getElementById('final-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', this.submitForm.bind(this));
        }

        // Banking finish button (temporary compatibility)
        const finishBtn = document.getElementById('finish-btn');
        if (finishBtn) {
            finishBtn.addEventListener('click', this.submitForm.bind(this));
        }
    }

    async submitForm() {
        if (this.submissionInProgress) {
            return;
        }

        try {
            this.submissionInProgress = true;
            this.showLoading();
            
            // Final validation of all steps
            if (!this.validateAllSteps()) {
                throw new Error('Por favor complete todos los pasos requeridos antes de enviar.');
            }
            
            // Collect all form data
            const formData = this.collectAllFormData();
            
            // Upload files to Firebase Storage
            const fileUrls = await this.uploadFilesToStorage();
            
            // Save data to Firestore
            const submissionId = await this.saveToFirestore(formData, fileUrls);
            
            // Send confirmation email (if needed)
            await this.sendConfirmationEmail(formData, submissionId);
            
            // Show success message
            this.showSuccessMessage(submissionId);
            
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.submissionInProgress = false;
            this.hideLoading();
        }
    }

    validateAllSteps() {
        const validationResults = {
            documents: this.formHandler.documentValidator.isValid(),
            company: this.formHandler.companyInfoHandler.isValid(),
            contact: this.formHandler.contactInfoHandler.isValid(),
            banking: this.formHandler.bankingValidator.isValid(),
            services: this.formHandler.servicesInfoHandler.isValid()
        };

        const invalidSteps = Object.keys(validationResults).filter(step => !validationResults[step]);
        
        if (invalidSteps.length > 0) {
            const stepTitles = {
                documents: 'Documentos',
                company: 'Información de la Empresa',
                contact: 'Información de Contacto',
                banking: 'Información Bancaria',
                services: 'Servicios y Capacidades'
            };
            
            const invalidStepNames = invalidSteps.map(step => stepTitles[step]).join(', ');
            throw new Error(`Los siguientes pasos requieren atención: ${invalidStepNames}`);
        }

        return true;
    }

    collectAllFormData() {
        const allData = this.formHandler.getAllFormData();
        
        // Add additional metadata
        allData.metadata = {
            ...allData.metadata,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            formVersion: '2.0',
            ipAddress: null, // Will be set by server if needed
            source: 'web_portal'
        };

        // Add validation checksums
        allData.validation = {
            documentsValid: this.formHandler.documentValidator.isValid(),
            companyValid: this.formHandler.companyInfoHandler.isValid(),
            contactValid: this.formHandler.contactInfoHandler.isValid(),
            bankingValid: this.formHandler.bankingValidator.isValid(),
            servicesValid: this.formHandler.servicesInfoHandler.isValid(),
            overallValid: true
        };

        return allData;
    }

    async uploadFilesToStorage() {
        if (!window.firebaseStorage) {
            throw new Error('Firebase Storage no está disponible');
        }

        const storage = window.firebaseStorage;
        const fileUrls = {};
        const uploadedFiles = this.formHandler.documentValidator.uploadedFiles;
        
        // Create unique folder for this submission
        const submissionId = this.generateSubmissionId();
        
        // Upload each document file
        for (const [type, file] of Object.entries(uploadedFiles)) {
            if (file) {
                try {
                    const fileName = `${type}_${Date.now()}_${file.name}`;
                    const storageRef = storage.ref(`suppliers/${submissionId}/documents/${fileName}`);
                    
                    // Upload file
                    const snapshot = await storageRef.put(file);
                    
                    // Get download URL
                    const downloadURL = await snapshot.ref.getDownloadURL();
                    
                    fileUrls[type] = {
                        url: downloadURL,
                        fileName: fileName,
                        originalName: file.name,
                        size: file.size,
                        type: file.type,
                        uploadedAt: new Date().toISOString()
                    };
                    
                } catch (error) {
                    console.error(`Error uploading ${type} file:`, error);
                    throw new Error(`Error al subir archivo ${type}: ${error.message}`);
                }
            }
        }

        // Upload services reference file if exists
        const referenciaFile = document.getElementById('referencias-file')?.files[0];
        if (referenciaFile) {
            try {
                const fileName = `referencias_${Date.now()}_${referenciaFile.name}`;
                const storageRef = storage.ref(`suppliers/${submissionId}/services/${fileName}`);
                
                const snapshot = await storageRef.put(referenciaFile);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                fileUrls.referencias = {
                    url: downloadURL,
                    fileName: fileName,
                    originalName: referenciaFile.name,
                    size: referenciaFile.size,
                    type: referenciaFile.type,
                    uploadedAt: new Date().toISOString()
                };
                
            } catch (error) {
                console.warn('Error uploading referencias file:', error);
                // This is optional, so we don't throw
            }
        }
        
        return fileUrls;
    }

    async saveToFirestore(formData, fileUrls) {
        if (!window.firebaseDB) {
            throw new Error('Firebase Database no está disponible');
        }

        const db = window.firebaseDB;
        
        const supplierData = {
            // Core data
            company: formData.company,
            contact: formData.contact,
            banking: formData.banking,
            services: formData.services,
            documents: formData.documents,
            
            // Files
            files: fileUrls,
            
            // Metadata
            metadata: formData.metadata,
            validation: formData.validation,
            
            // Status
            status: 'pending_review',
            reviewStatus: {
                documents: 'pending',
                company: 'pending',
                contact: 'pending',
                banking: 'pending',
                services: 'pending'
            },
            
            // Timestamps
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Add to suppliers collection
        const docRef = await db.collection('suppliers').add(supplierData);
        
        // Create activity log entry
        await this.createActivityLogEntry(docRef.id, 'submitted', 'Solicitud de registro enviada');
        
        return docRef.id;
    }

    async createActivityLogEntry(supplierId, action, description) {
        try {
            const db = window.firebaseDB;
            
            await db.collection('supplier_activities').add({
                supplierId: supplierId,
                action: action,
                description: description,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                source: 'web_portal'
            });
        } catch (error) {
            console.warn('Error creating activity log:', error);
            // Don't throw, this is not critical
        }
    }

    async sendConfirmationEmail(formData, submissionId) {
        // This would typically call a Cloud Function to send email
        // For now, we'll just log it
        console.log('Confirmation email should be sent for submission:', submissionId);
        
        // If you have email service configured:
        /*
        try {
            const functions = firebase.functions();
            const sendEmail = functions.httpsCallable('sendConfirmationEmail');
            
            await sendEmail({
                submissionId: submissionId,
                email: formData.contact.representanteLegal.email,
                companyName: formData.company.nombreComercial
            });
        } catch (error) {
            console.warn('Error sending confirmation email:', error);
            // Don't throw, email is not critical for submission
        }
        */
    }

    generateSubmissionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `SUP_${timestamp}_${random}`;
    }

    showSuccessMessage(submissionId) {
        const formCard = document.querySelector('.form-card');
        if (formCard) {
            formCard.innerHTML = `
                <div class="success-container">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2>¡Registro Exitoso!</h2>
                    <p>Su solicitud de registro como proveedor ha sido enviada correctamente.</p>
                    <div class="submission-details">
                        <p><strong>Número de referencia:</strong> ${submissionId}</p>
                        <p><strong>Fecha de envío:</strong> ${new Date().toLocaleDateString('es-MX')}</p>
                    </div>
                    <div class="next-steps">
                        <h3>Próximos pasos:</h3>
                        <ul>
                            <li>Recibirá un correo de confirmación en los próximos minutos</li>
                            <li>Nuestro equipo revisará su solicitud en 3-5 días hábiles</li>
                            <li>Le notificaremos sobre el estatus de su solicitud</li>
                        </ul>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="this.downloadConfirmation('${submissionId}')">
                            <i class="fas fa-download"></i> Descargar Comprobante
                        </button>
                        <button class="btn btn-secondary" onclick="location.reload()">
                            <i class="fas fa-plus"></i> Nuevo Registro
                        </button>
                    </div>
                </div>
            `;
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    showErrorMessage(message) {
        if (window.portalApp) {
            window.portalApp.showErrorMessage(message);
        } else {
            alert(`Error: ${message}`);
        }
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('active');
            
            // Update loading message for submission
            const loadingText = loadingOverlay.querySelector('p');
            if (loadingText) {
                loadingText.textContent = 'Enviando solicitud de registro...';
            }
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
            
            // Reset loading message
            const loadingText = loadingOverlay.querySelector('p');
            if (loadingText) {
                loadingText.textContent = 'Procesando documentos...';
            }
        }
    }

    // Method to download submission confirmation
    downloadConfirmation(submissionId) {
        const formData = this.formHandler.getAllFormData();
        
        // Create a simple text confirmation
        const confirmationText = `
COMPROBANTE DE ENVÍO - PORTAL DE PROVEEDORES T&C GROUP

Número de referencia: ${submissionId}
Fecha de envío: ${new Date().toLocaleString('es-MX')}

Empresa: ${formData.company.nombreComercial}
RFC: ${formData.company.rfc}
Representante Legal: ${formData.contact.representanteLegal?.nombre} ${formData.contact.representanteLegal?.apellidos}

Su solicitud ha sido recibida y está siendo procesada.
Recibirá una notificación sobre el estatus en 3-5 días hábiles.

Para consultas, contacte: compras@tycgroup.com
        `;
        
        // Create and download file
        const blob = new Blob([confirmationText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Comprobante_${submissionId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}