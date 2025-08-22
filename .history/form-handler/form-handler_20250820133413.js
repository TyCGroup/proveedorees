// form-handler.js - Main file that combines all modules
class FormHandler extends FormHandlerCore {
    constructor() {
        super();
        
        // Initialize banking data structure
        this.initializeBankingData();
        
        // Mix in all modules
        Object.assign(this, FormHandlerDocuments);
        Object.assign(this, FormHandlerBanking);
        Object.assign(this, FormHandlerNavigation);
        Object.assign(this, FormHandlerSubmit);
        
        // Initialize all event listeners
        this.initializeEventListeners();
    }
}

// Navigation module
const FormHandlerNavigation = {
    // Show company information step
    showCompanyInfo() {
        this.fillCompanyForm();
        
        document.getElementById('documents-step').classList.remove('active');
        document.getElementById('company-step').classList.add('active');
        
        this.updateProgress(66, 'Paso 2 de 3: Información de la Empresa');
        this.currentStep = 'company';
    },

    // Show banking information step
    showBankingInfo() {
        document.getElementById('company-step').classList.remove('active');
        document.getElementById('banking-step').classList.add('active');
        
        this.updateProgress(100, 'Paso 3 de 3: Información Bancaria');
        this.setupBankingListeners();
        this.currentStep = 'banking';
    },

    // Show documents step
    showDocuments() {
        if (this.currentStep === 'company') {
            document.getElementById('company-step').classList.remove('active');
            document.getElementById('documents-step').classList.add('active');
            this.updateProgress(33, 'Paso 1 de 3: Documentos');
            this.currentStep = 'documents';
        } else if (this.currentStep === 'banking') {
            document.getElementById('banking-step').classList.remove('active');
            document.getElementById('company-step').classList.add('active');
            this.updateProgress(66, 'Paso 2 de 3: Información de la Empresa');
            this.currentStep = 'company';
        }
    },

    // Fill company form with OCR data
    fillCompanyForm() {
        const companyInfo = window.ocrProcessor.getCompanyInfo();
        
        Object.keys(companyInfo).forEach(field => {
            const input = document.getElementById(this.mapFieldToId(field));
            if (input) {
                input.value = companyInfo[field];
            }
        });
    },

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
};

// Submit module
const FormHandlerSubmit = {
    // Submit form
    async submitForm() {
        try {
            this.showLoading();
            
            const formData = this.collectFormData();
            const fileUrls = await this.uploadFilesToStorage();
            await this.saveToFirestore(formData, fileUrls);
            
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showErrorMessage(error.message);
        } finally {
            this.hideLoading();
        }
    },

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
        
        // Add structured data
        formData.stepData = { ...this.stepData };
        
        // Add metadata
        formData.submissionDate = new Date().toISOString();
        formData.status = 'pending';
        formData.validationResults = window.ocrProcessor.validationResults;
        formData.bankingValidation = this.validationStatus.banking;
        
        return formData;
    },

    // Upload files to Firebase Storage
    async uploadFilesToStorage() {
        const storage = firebase.storage();
        const fileUrls = {};
        
        const submissionId = Date.now().toString();
        
        for (const [type, file] of Object.entries(this.uploadedFiles)) {
            if (file) {
                const storageRef = storage.ref(`suppliers/${submissionId}/${type}_${file.name}`);
                await storageRef.put(file);
                fileUrls[type] = await storageRef.getDownloadURL();
            }
        }
        
        return fileUrls;
    },

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
    },

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
};

// Create global instance
window.formHandler = new FormHandler();

// Global functions for HTML onclick events
window.triggerFileUpload = (type) => window.formHandler.triggerFileUpload(type);
window.handleFileUpload = (type, input) => window.formHandler.handleFileUpload(type, input);
window.showCompanyInfo = () => window.formHandler.showCompanyInfo();
window.showBankingInfo = () => window.formHandler.showBankingInfo();
window.showDocuments = () => window.formHandler.showDocuments();
window.submitForm = () => window.formHandler.submitForm();