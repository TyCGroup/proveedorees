// JS/contact-only-handler.js - Manejador del formulario de contacto simplificado

class ContactOnlyHandler {
    constructor() {
        this.formData = {
            companyName: '',
            contactName: '',
            contactPhone: '',
            contactEmail: ''
        };
        this.validationStatus = {
            companyName: false,
            contactName: false,
            contactPhone: false,
            contactEmail: false
        };
        this.uploadedFiles = {
            opinion: null,
            constancia: null,
            bancario: null
        };
        this.originalFileUrls = {};
        this.initialized = false;
    }

    // Inicializar el manejador
    init() {
        if (this.initialized) return;
        
        console.log('Inicializando ContactOnlyHandler...');
        this.loadDocumentsFromSessionStorage();
        this.setupEventListeners();
        this.renderDocumentsSummary();
        this.initialized = true;
        console.log('ContactOnlyHandler inicializado correctamente');
    }

    // Cargar documentos desde sessionStorage - CORREGIDO
    loadDocumentsFromSessionStorage() {
        try {
            // Cargar archivos subidos
            const storedFiles = sessionStorage.getItem('uploadedFiles');
            if (storedFiles) {
                const filesData = JSON.parse(storedFiles);
                console.log('Datos de archivos desde sessionStorage:', filesData);
                
                // Verificar si los archivos están como objetos File o como data URLs
                for (const [type, fileData] of Object.entries(filesData)) {
                    if (fileData) {
                        console.log(`Archivo ${type}:`, {
                            name: fileData.name,
                            size: fileData.size,
                            type: fileData.type,
                            hasArrayBuffer: fileData.arrayBuffer ? 'Sí' : 'No',
                            hasDataURL: fileData.dataURL ? 'Sí' : 'No'
                        });
                        
                        // Si tenemos dataURL, reconstruir el File
                        if (fileData.dataURL && !fileData.arrayBuffer) {
                            this.uploadedFiles[type] = this.dataURLToFile(fileData.dataURL, fileData.name, fileData.type);
                        } else if (fileData.arrayBuffer) {
                            // Si tenemos arrayBuffer, reconstruir el File
                            const uint8Array = new Uint8Array(fileData.arrayBuffer);
                            this.uploadedFiles[type] = new File([uint8Array], fileData.name, { type: fileData.type });
                        } else if (fileData instanceof File) {
                            // Si ya es un File object
                            this.uploadedFiles[type] = fileData;
                        } else {
                            console.warn(`Archivo ${type} no tiene datos válidos:`, fileData);
                        }
                    }
                }
                
                console.log('Archivos reconstruidos:', Object.keys(this.uploadedFiles));
            } else {
                console.log('No se encontraron archivos en sessionStorage');
            }

            // Cargar información extraída de documentos
            const storedCompanyInfo = sessionStorage.getItem('extractedCompanyInfo');
            if (storedCompanyInfo) {
                const companyInfo = JSON.parse(storedCompanyInfo);
                this.prefillCompanyName(companyInfo);
            }

        } catch (error) {
            console.error('Error cargando datos desde sessionStorage:', error);
        }
    }

    // Función auxiliar para convertir dataURL a File
    dataURLToFile(dataURL, fileName, mimeType) {
        try {
            const arr = dataURL.split(',');
            const mime = arr[0].match(/:(.*?);/)[1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            
            return new File([u8arr], fileName, { type: mimeType || mime });
        } catch (error) {
            console.error('Error convirtiendo dataURL a File:', error);
            return null;
        }
    }

    // Pre-llenar el nombre de la empresa si está disponible
    prefillCompanyName(companyInfo) {
        const companyNameInput = document.getElementById('company-name');
        if (companyNameInput && companyInfo.nombreComercial) {
            companyNameInput.value = companyInfo.nombreComercial;
            this.formData.companyName = companyInfo.nombreComercial;
            this.validateField('company-name');
        }
    }

    // Configurar event listeners
    setupEventListeners() {
        const form = document.getElementById('contact-only-form');
        if (form) {
            form.addEventListener('submit', this.handleFormSubmit.bind(this));
        }

        // Event listeners para validación en tiempo real
        const inputs = [
            { id: 'company-name', handler: this.handleCompanyNameInput.bind(this) },
            { id: 'contact-name', handler: this.handleContactNameInput.bind(this) },
            { id: 'contact-phone', handler: this.handlePhoneInput.bind(this) },
            { id: 'contact-email', handler: this.handleEmailInput.bind(this) }
        ];

        inputs.forEach(({ id, handler }) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', handler);
                input.addEventListener('blur', () => this.validateField(id));
            }
        });
    }

    // Manejar entrada del nombre de empresa
    handleCompanyNameInput(event) {
        const input = event.target;
        let value = input.value;

        // Permitir letras, números, espacios, acentos y algunos símbolos comunes
        value = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\d\.\,\(\)\&\-]/g, '');
        value = value.replace(/^\s+/, ''); // No espacios al inicio
        value = value.replace(/\s{2,}/g, ' '); // No múltiples espacios

        input.value = value;
        this.formData.companyName = value;
    }

    // Manejar entrada del nombre de contacto
    handleContactNameInput(event) {
        const input = event.target;
        let value = input.value;

        // Solo letras, espacios, acentos y guiones
        value = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\-]/g, '');
        value = value.replace(/^\s+/, ''); // No espacios al inicio
        value = value.replace(/\s{2,}/g, ' '); // No múltiples espacios

        input.value = value;
        this.formData.contactName = value;
    }

    // Manejar entrada de teléfono
    handlePhoneInput(event) {
        const input = event.target;
        let value = input.value;

        // Solo números, espacios y guiones
        value = value.replace(/[^\d\s\-]/g, '');
        
        // Formatear automáticamente (55 1234 5678)
        value = value.replace(/\D/g, ''); // Solo números
        if (value.length >= 2) {
            value = value.substring(0, 2) + ' ' + value.substring(2);
        }
        if (value.length >= 7) {
            value = value.substring(0, 7) + ' ' + value.substring(7, 11);
        }

        input.value = value;
        this.formData.contactPhone = value;
    }

    // Manejar entrada de email
    handleEmailInput(event) {
        const input = event.target;
        let value = input.value.toLowerCase().trim();
        
        input.value = value;
        this.formData.contactEmail = value;
    }

    // Validar campo individual
    validateField(fieldId) {
        const input = document.getElementById(fieldId);
        if (!input) return false;

        const value = input.value.trim();
        let isValid = false;
        let message = '';

        switch (fieldId) {
            case 'company-name':
                if (!value) {
                    message = 'El nombre de la empresa es requerido';
                } else if (value.length < 3) {
                    message = 'El nombre debe tener al menos 3 caracteres';
                } else {
                    isValid = true;
                }
                this.validationStatus.companyName = isValid;
                break;

            case 'contact-name':
                if (!value) {
                    message = 'El nombre del contacto es requerido';
                } else if (value.length < 2) {
                    message = 'El nombre debe tener al menos 2 caracteres';
                } else {
                    isValid = true;
                }
                this.validationStatus.contactName = isValid;
                break;

            case 'contact-phone':
                const phoneNumbers = value.replace(/\D/g, '');
                if (!value) {
                    message = 'El teléfono es requerido';
                } else if (phoneNumbers.length < 10) {
                    message = 'El teléfono debe tener al menos 10 dígitos';
                } else {
                    isValid = true;
                }
                this.validationStatus.contactPhone = isValid;
                break;

            case 'contact-email':
                if (!value) {
                    message = 'El email es requerido';
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    message = 'El formato del email no es válido';
                } else {
                    isValid = true;
                }
                this.validationStatus.contactEmail = isValid;
                break;
        }

        this.showFieldValidation(input, isValid, message);
        this.updateSubmitButton();
        return isValid;
    }

    // Mostrar validación visual del campo
    showFieldValidation(input, isValid, message) {
        // Remover clases previas
        input.classList.remove('valid', 'invalid');
        
        // Agregar clase según estado
        if (input.value.trim()) {
            input.classList.add(isValid ? 'valid' : 'invalid');
        }

        // Mostrar/ocultar mensaje de error
        let errorElement = input.parentNode.querySelector('.field-error');
        
        if (message && !isValid) {
            if (!errorElement) {
                errorElement = document.createElement('span');
                errorElement.className = 'field-error';
                input.parentNode.appendChild(errorElement);
            }
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        } else if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    // Actualizar estado del botón de envío
    updateSubmitButton() {
        const submitBtn = document.getElementById('submit-contact-btn');
        if (!submitBtn) return;

        const allValid = Object.values(this.validationStatus).every(status => status === true);
        submitBtn.disabled = !allValid;
    }

    // Renderizar resumen de documentos - MEJORADO
    renderDocumentsSummary() {
        const summaryContainer = document.getElementById('documents-summary');
        if (!summaryContainer) return;

        const documentTypes = {
            opinion: {
                name: 'Opinión de Cumplimiento 32D',
                description: 'Documento de cumplimiento fiscal'
            },
            constancia: {
                name: 'Constancia de Situación Fiscal',
                description: 'Constancia del SAT'
            },
            bancario: {
                name: 'Estado de Cuenta Bancario',
                description: 'Carátula del estado de cuenta'
            }
        };

        let html = '';
        let hasDocuments = false;

        Object.keys(documentTypes).forEach(type => {
            const file = this.uploadedFiles[type];
            if (file) {
                hasDocuments = true;
                const doc = documentTypes[type];
                const fileSize = this.formatFileSize(file.size);
                
                html += `
                    <div class="document-item">
                        <div class="document-info">
                            <div class="document-icon">
                                <i class="fas fa-file-pdf"></i>
                            </div>
                            <div class="document-details">
                                <h4>${doc.name}</h4>
                                <p>${doc.description} - ${fileSize}</p>
                            </div>
                        </div>
                        <div class="document-status uploaded">Subido</div>
                    </div>
                `;
            }
        });

        if (!hasDocuments) {
            html = `
                <div class="document-item">
                    <div class="document-info">
                        <div class="document-icon" style="background: #ef4444;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="document-details">
                            <h4>No se encontraron documentos</h4>
                            <p>No hay documentos cargados en la sesión actual</p>
                        </div>
                    </div>
                    <div class="document-status error">Faltante</div>
                </div>
            `;
        }

        summaryContainer.innerHTML = html;
    }

    // Manejar envío del formulario
    async handleFormSubmit(event) {
        event.preventDefault();
        
        // Validar todos los campos
        const allFieldsValid = this.validateAllFields();
        if (!allFieldsValid) {
            this.showError('Por favor complete todos los campos requeridos correctamente.');
            return;
        }

        // Verificar que tenemos archivos válidos antes de continuar
        const hasValidFiles = this.validateFiles();
        if (!hasValidFiles) {
            this.showError('No se pudieron cargar los archivos correctamente. Por favor, suba los documentos nuevamente.');
            return;
        }

        try {
            this.showLoading();

            // Subir archivos a Firebase Storage
            const fileUrls = await this.uploadFilesToStorage();

            // Guardar en Firestore
            await this.saveToFirestore(fileUrls);

            // Mostrar éxito
            this.showSuccess();

        } catch (error) {
            console.error('Error enviando formulario:', error);
            this.showError('Error al enviar la información. Por favor intente nuevamente.');
        } finally {
            this.hideLoading();
        }
    }

    // Validar todos los campos
    validateAllFields() {
        const fields = ['company-name', 'contact-name', 'contact-phone', 'contact-email'];
        let allValid = true;

        fields.forEach(fieldId => {
            if (!this.validateField(fieldId)) {
                allValid = false;
            }
        });

        return allValid;
    }

    // Validar que los archivos son válidos - NUEVO
    validateFiles() {
        let hasValidFiles = false;
        
        for (const [type, file] of Object.entries(this.uploadedFiles)) {
            if (file && file instanceof File && file.size > 0) {
                hasValidFiles = true;
                console.log(`Archivo ${type} válido:`, {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            } else if (file) {
                console.warn(`Archivo ${type} inválido:`, file);
            }
        }
        
        return hasValidFiles;
    }

    // Subir archivos a Firebase Storage - MEJORADO con validación
    async uploadFilesToStorage() {
        if (!window.firebase) {
            throw new Error('Firebase no está disponible');
        }

        const storage = firebase.storage();
        const fileUrls = {};
        
        const submissionId = Date.now().toString();
        
        const fileNameMapping = {
            'opinion': '32D.pdf',
            'constancia': 'CSF.pdf', 
            'bancario': 'EDO.CTA.pdf'
        };
        
        for (const [type, file] of Object.entries(this.uploadedFiles)) {
            if (file && file instanceof File && file.size > 0) {
                console.log(`Subiendo archivo ${type}:`, {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
                
                const standardFileName = fileNameMapping[type] || `${type}.pdf`;
                const storageRef = storage.ref(`manual-review/${submissionId}/${standardFileName}`);
                
                try {
                    // Subir el archivo
                    const snapshot = await storageRef.put(file);
                    console.log(`Archivo ${type} subido correctamente:`, snapshot.metadata);
                    
                    // Obtener URL de descarga
                    fileUrls[type] = await storageRef.getDownloadURL();
                    console.log(`URL obtenida para ${type}:`, fileUrls[type]);
                    
                } catch (uploadError) {
                    console.error(`Error subiendo archivo ${type}:`, uploadError);
                    throw new Error(`Error subiendo ${type}: ${uploadError.message}`);
                }
            } else {
                console.warn(`Archivo ${type} no válido o vacío:`, file);
            }
        }
        
        if (Object.keys(fileUrls).length === 0) {
            throw new Error('No se pudo subir ningún archivo');
        }
        
        return fileUrls;
    }

    // Guardar en Firestore (colección separada)
    async saveToFirestore(fileUrls) {
        if (!window.firebaseDB) {
            throw new Error('Firestore no está disponible');
        }

        const db = window.firebaseDB;
        
        const submissionData = {
            // Información básica
            companyName: this.formData.companyName,
            contactName: this.formData.contactName,
            contactPhone: this.formData.contactPhone,
            contactEmail: this.formData.contactEmail,
            
            // URLs de archivos
            files: fileUrls,
            
            // Metadatos
            submissionType: 'manual-review',
            status: 'pending-manual-review',
            reason: 'documents-validation-failed',
            submissionDate: new Date().toISOString(),
            
            // Timestamps de Firebase
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Guardar en colección separada para revisión manual
        const docRef = await db.collection('manual-review-suppliers').add(submissionData);
        console.log('Datos guardados en manual-review-suppliers con ID:', docRef.id);
        
        return docRef.id;
    }

    // Formatear tamaño de archivo
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Mostrar loading
    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    // Ocultar loading
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    }

    // Mostrar éxito
    showSuccess() {
        this.hideLoading();
        const overlay = document.getElementById('success-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    // Mostrar error
    showError(message) {
        // Crear notificación de error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Agregar estilos si no existen
        if (!document.getElementById('notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .error-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10000;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease-out;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .notification-content button {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0.25rem;
                    margin-left: auto;
                    border-radius: 4px;
                }
                .notification-content button:hover {
                    background: rgba(255, 255, 255, 0.1);
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(errorDiv);

        // Auto remover después de 5 segundos
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Función global para regresar a documentos
window.goBackToDocuments = function() {
    // Limpiar datos de sesión
    try {
        sessionStorage.removeItem('uploadedFiles');
        sessionStorage.removeItem('extractedCompanyInfo');
        sessionStorage.removeItem('validationSummary');
        console.log('SessionStorage limpiado');
    } catch (error) {
        console.error('Error limpiando sessionStorage:', error);
    }
    
    // Regresar a la página principal
    console.log('Redirigiendo a index.html...');
    window.location.href = '../index.html';
};

// Función alternativa por si el botón usa otro nombre
window.regresarADocumentos = function() {
    window.goBackToDocuments();
};

// Asegurar que la función esté disponible cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Buscar el botón de regresar y asignar la función directamente
    const backButton = document.querySelector('button[onclick*="regresar"], button[onclick*="back"], #back-btn, .back-btn');
    if (backButton) {
        backButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.goBackToDocuments();
        });
    }
    
    // También buscar por texto del botón
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        if (button.textContent.includes('Regresar') || button.textContent.includes('Documentos')) {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                window.goBackToDocuments();
            });
        }
    });
});

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Asegurar que la función goBackToDocuments esté disponible inmediatamente
    console.log('Configurando función goBackToDocuments...');
    
    // Esperar a que Firebase esté listo
    const waitForFirebase = () => {
        if (window.firebase && window.firebaseDB) {
            console.log('Firebase está listo, inicializando ContactOnlyHandler...');
            window.contactOnlyHandler = new ContactOnlyHandler();
            window.contactOnlyHandler.init();
        } else {
            console.log('Esperando a Firebase...');
            setTimeout(waitForFirebase, 100);
        }
    };
    
    waitForFirebase();
    
    // Configurar el botón de regresar como respaldo
    setTimeout(() => {
        const backButton = document.querySelector('button[onclick="goBackToDocuments()"]');
        if (backButton) {
            console.log('Botón de regresar encontrado y configurado');
            backButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Click en botón regresar detectado');
                window.goBackToDocuments();
            });
        }
    }, 500);
});

// Exportar para uso global
window.ContactOnlyHandler = ContactOnlyHandler;