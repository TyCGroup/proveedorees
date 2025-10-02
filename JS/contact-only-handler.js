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
        this.uploadedFiles = { opinion: null, constancia: null, bancario: null };
        this.uploadedUrls  = { opinion: null, constancia: null, bancario: null }; // ⬅️ NUEVO
        this.initialized = false;
    }

    // === INIT ==========================================================
    async init() {
        if (this.initialized) return;
        console.log('Inicializando ContactOnlyHandler...');
        await this.loadDocumentsFromSessionStorage();   // ahora es async
        this.setupEventListeners();
        this.renderDocumentsSummary();
        this.initialized = true;
        console.log('ContactOnlyHandler inicializado correctamente');
    }

    // === SESSION LOAD ==================================================
    async loadDocumentsFromSessionStorage() {
        try {
            // 1) Archivos serializados
            const storedFiles = sessionStorage.getItem('uploadedFiles');
            if (storedFiles) {
                const filesData = JSON.parse(storedFiles);
                for (const [type, fileData] of Object.entries(filesData)) {
                    if (!fileData) continue;
                    if (fileData.dataURL) {
                        this.uploadedFiles[type] = this.dataURLToFile(fileData.dataURL, fileData.name, fileData.type);
                    } else if (fileData.arrayBuffer) {
                        const uint8Array = new Uint8Array(fileData.arrayBuffer);
                        this.uploadedFiles[type] = new File([uint8Array], fileData.name, { type: fileData.type || 'application/pdf' });
                    }
                }
            }

            // 2) URLs originales (subidas por ocr-processor)  ⬅️ NUEVO
            const storedUrls = sessionStorage.getItem('uploadedUrls');
            if (storedUrls) {
                this.uploadedUrls = JSON.parse(storedUrls);
            }

            // 3) Si no hay File pero sí URL, descargar y reconstruir File  ⬅️ NUEVO
            for (const type of ['opinion','constancia','bancario']) {
                if (!this.uploadedFiles[type] && this.uploadedUrls[type]) {
                    try {
                        this.uploadedFiles[type] = await this.fetchFileFromUrl(
                            this.uploadedUrls[type],
                            this.defaultFileName(type)
                        );
                        console.log(`Reconstruido ${type} desde URL.`);
                    } catch (e) {
                        console.warn(`No se pudo descargar ${type} desde URL, se enviará como URL:`, e);
                    }
                }
            }

            // 4) Nombre de empresa extraído (si existe)
            const storedCompanyInfo = sessionStorage.getItem('extractedCompanyInfo');
            if (storedCompanyInfo) {
                const companyInfo = JSON.parse(storedCompanyInfo);
                this.prefillCompanyName(companyInfo);
            }
        } catch (error) {
            console.error('Error cargando datos desde sessionStorage:', error);
        }
    }

    // === HELPERS FILE/URL =============================================
    dataURLToFile(dataURL, fileName, mimeType) {
        try {
            const arr = dataURL.split(',');
            const mime = mimeType || arr[0].match(/:(.*?);/)[1] || 'application/pdf';
            const bstr = atob(arr[1]); let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            return new File([u8arr], fileName || 'archivo.pdf', { type: mime });
        } catch (error) {
            console.error('Error convirtiendo dataURL a File:', error);
            return null;
        }
    }

    async fetchFileFromUrl(url, filename = 'archivo.pdf') {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type || 'application/pdf' });
    }

    defaultFileName(type) {
        return ({ opinion: '32D.pdf', constancia: 'CSF.pdf', bancario: 'EDO.CTA.pdf' }[type]) || `${type}.pdf`;
    }

    // === UI / VALIDACIÓN CAMPOS =======================================
    prefillCompanyName(companyInfo) {
        const companyNameInput = document.getElementById('company-name');
        if (companyNameInput && companyInfo?.nombreComercial) {
            companyNameInput.value = companyInfo.nombreComercial;
            this.formData.companyName = companyInfo.nombreComercial;
            this.validateField('company-name');
        }
    }

    setupEventListeners() {
        const form = document.getElementById('contact-only-form');
        if (form) form.addEventListener('submit', this.handleFormSubmit.bind(this));

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

    handleCompanyNameInput(e){ let v=e.target.value; v=v.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\d\.\,\(\)\&\-]/g,'').replace(/^\s+/,'').replace(/\s{2,}/g,' '); e.target.value=v; this.formData.companyName=v; }
    handleContactNameInput(e){ let v=e.target.value; v=v.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\-]/g,'').replace(/^\s+/,'').replace(/\s{2,}/g,' '); e.target.value=v; this.formData.contactName=v; }
    handlePhoneInput(e){ let v=e.target.value.replace(/[^\d\s\-]/g,'').replace(/\D/g,''); if(v.length>=2) v=v.substring(0,2)+' '+v.substring(2); if(v.length>=7) v=v.substring(0,7)+' '+v.substring(7,11); e.target.value=v; this.formData.contactPhone=v; }
    handleEmailInput(e){ const v=e.target.value.toLowerCase().trim(); e.target.value=v; this.formData.contactEmail=v; }

    validateField(fieldId){
        const input=document.getElementById(fieldId); if(!input) return false;
        const value=input.value.trim(); let isValid=false; let message='';
        switch(fieldId){
            case 'company-name': isValid=value.length>=3; message=isValid?'':'El nombre debe tener al menos 3 caracteres'; this.validationStatus.companyName=isValid; break;
            case 'contact-name': isValid=value.length>=2; message=isValid?'':'El nombre debe tener al menos 2 caracteres'; this.validationStatus.contactName=isValid; break;
            case 'contact-phone': { const digits=value.replace(/\D/g,''); isValid=digits.length>=10; message=isValid?'':'El teléfono debe tener al menos 10 dígitos'; this.validationStatus.contactPhone=isValid; break; }
            case 'contact-email': isValid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); message=isValid?'':'El formato del email no es válido'; this.validationStatus.contactEmail=isValid; break;
        }
        this.showFieldValidation(input, isValid, message);
        this.updateSubmitButton();
        return isValid;
    }
    showFieldValidation(input,isValid,message){
        input.classList.remove('valid','invalid');
        if(input.value.trim()) input.classList.add(isValid?'valid':'invalid');
        let errorEl=input.parentNode.querySelector('.field-error');
        if(message && !isValid){ if(!errorEl){ errorEl=document.createElement('span'); errorEl.className='field-error'; input.parentNode.appendChild(errorEl);} errorEl.textContent=message; errorEl.style.display='block';}
        else if(errorEl){ errorEl.style.display='none';}
    }
    updateSubmitButton(){
        const btn=document.getElementById('submit-contact-btn');
        if(!btn) return;
        btn.disabled=!Object.values(this.validationStatus).every(v=>v===true);
    }

    // === RESUMEN DE DOCUMENTOS ========================================
    renderDocumentsSummary() {
        const box = document.getElementById('documents-summary');
        if (!box) return;

        const labels = {
            opinion:   { name:'Opinión de Cumplimiento 32D', desc:'Documento de cumplimiento fiscal' },
            constancia:{ name:'Constancia de Situación Fiscal', desc:'Constancia del SAT' },
            bancario:  { name:'Estado de Cuenta Bancario', desc:'Carátula del estado de cuenta' }
        };

        let html = '';
        let hasAny = false;

        for (const type of ['opinion','constancia','bancario']) {
            const f = this.uploadedFiles[type];
            const urlOnly = !f && !!this.uploadedUrls[type];
            if (f || urlOnly) {
                hasAny = true;
                const size = f ? this.formatFileSize(f.size) : 'desde URL';
                html += `
                    <div class="document-item">
                        <div class="document-info">
                            <div class="document-icon"><i class="fas fa-file-pdf"></i></div>
                            <div class="document-details">
                                <h4>${labels[type].name}</h4>
                                <p>${labels[type].desc} - ${size}</p>
                            </div>
                        </div>
                        <div class="document-status uploaded">${urlOnly ? 'Adjuntado (URL)' : 'Subido'}</div>
                    </div>`;
            }
        }

        if (!hasAny) {
            html = `
            <div class="document-item">
                <div class="document-info">
                    <div class="document-icon" style="background:#ef4444;"><i class="fas fa-exclamation-triangle"></i></div>
                    <div class="document-details">
                        <h4>No se encontraron documentos</h4>
                        <p>No hay documentos cargados en la sesión actual</p>
                    </div>
                </div>
                <div class="document-status error">Faltante</div>
            </div>`;
        }

        box.innerHTML = html;
    }

    // === SUBMIT ========================================================
    async handleFormSubmit(e) {
        e.preventDefault();

        const ok = ['company-name','contact-name','contact-phone','contact-email']
            .map(id => this.validateField(id))
            .every(Boolean);
        if (!ok) return this.showError('Por favor complete todos los campos requeridos.');

        if (!this.validateFiles()) {
            return this.showError('No se pudieron preparar los documentos. Suba nuevamente los archivos.');
        }

        try {
            this.showLoading();
            const fileUrls = await this.uploadFilesToStorage();
            await this.saveToFirestore(fileUrls);
            this.showSuccess();
        } catch (err) {
            console.error('Error enviando formulario:', err);
            this.showError('Error al enviar la información. Por favor intente nuevamente.');
        } finally {
            this.hideLoading();
        }
    }

    validateFiles() {
        // Consideramos válido si hay al menos un File o una URL para alguno de los 3 tipos
        return ['opinion','constancia','bancario'].some(t => {
            const f = this.uploadedFiles[t];
            return (f && f instanceof File && f.size > 0) || !!this.uploadedUrls[t];
        });
    }

    // ⬇⬇⬇ Aquí reintentamos subir incluso si sólo teníamos URL
    async uploadFilesToStorage() {
        if (!window.firebase) throw new Error('Firebase no está disponible');
        const storage = firebase.storage();
        const fileUrls = {};

        const submissionId = Date.now().toString();
        const names = { opinion:'32D.pdf', constancia:'CSF.pdf', bancario:'EDO.CTA.pdf' };

        for (const type of ['opinion','constancia','bancario']) {
            let file = this.uploadedFiles[type];

            // Si no hay File pero sí URL -> descargar y convertir a File
            if ((!file || !(file instanceof File) || file.size === 0) && this.uploadedUrls[type]) {
                try {
                    file = await this.fetchFileFromUrl(this.uploadedUrls[type], names[type]);
                } catch (e) {
                    console.warn(`No se pudo descargar ${type} desde URL, se guardará la URL directa.`, e);
                }
            }

            if (file && file instanceof File && file.size > 0) {
                const storageRef = storage.ref(`manual-review/${submissionId}/${names[type]}`);
                const metadata = { contentType: 'application/pdf' };
                try {
                    await storageRef.put(file, metadata);
                    fileUrls[type] = await storageRef.getDownloadURL();
                } catch (uploadError) {
                    console.error(`Error subiendo archivo ${type}:`, uploadError);
                    // fallback a URL si existe
                    if (this.uploadedUrls[type]) fileUrls[type] = this.uploadedUrls[type];
                }
            } else if (this.uploadedUrls[type]) {
                // último recurso: guardar URL existente
                fileUrls[type] = this.uploadedUrls[type];
            }
        }

        if (Object.keys(fileUrls).length === 0) {
            throw new Error('No se pudo subir ningún archivo');
        }
        return fileUrls;
    }

    // Guardar en Firestore (colección separada)
    async saveToFirestore(fileUrls) {
        if (!window.firebaseDB) throw new Error('Firestore no está disponible');
        const db = window.firebaseDB;

        const submissionData = {
            companyName: this.formData.companyName,
            contactName: this.formData.contactName,
            contactPhone: this.formData.contactPhone,
            contactEmail: this.formData.contactEmail,
            files: fileUrls,
            submissionType: 'manual-review',
            status: 'pending-manual-review',
            reason: 'documents-validation-failed',
            submissionDate: new Date().toISOString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('manual-review-suppliers').add(submissionData);
        console.log('Datos guardados en manual-review-suppliers con ID:', docRef.id);
        return docRef.id;
    }

    // === UTILIDAD UI ===================================================
    formatFileSize(bytes){ if(bytes===0) return '0 Bytes'; const k=1024,s=['Bytes','KB','MB','GB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+' '+s[i]; }
    showLoading(){ const o=document.getElementById('loading-overlay'); if(o){ o.classList.add('active'); document.body.style.overflow='hidden'; } }
    hideLoading(){ const o=document.getElementById('loading-overlay'); if(o){ o.classList.remove('active'); document.body.style.overflow='auto'; } }
    showSuccess(){ this.hideLoading(); const o=document.getElementById('success-overlay'); if(o){ o.style.display='flex'; document.body.style.overflow='hidden'; } }
    showError(message){
        const d=document.createElement('div'); d.className='error-notification';
        d.innerHTML=`<div class="notification-content"><i class="fas fa-exclamation-triangle"></i><span>${message}</span><button onclick="this.parentElement.parentElement.remove()"><i class="fas fa-times"></i></button></div>`;
        if(!document.getElementById('notification-styles')){
            const s=document.createElement('style'); s.id='notification-styles'; s.textContent=`
                .error-notification{position:fixed;top:20px;right:20px;background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:white;padding:1rem;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:10000;max-width:400px;animation:slideInRight .3s ease-out}
                .notification-content{display:flex;align-items:center;gap:.5rem}
                .notification-content button{background:none;border:none;color:white;cursor:pointer;padding:.25rem;margin-left:auto;border-radius:4px}
                .notification-content button:hover{background:rgba(255,255,255,.1)}
                @keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
            `; document.head.appendChild(s);
        }
        document.body.appendChild(d); setTimeout(()=>{d.parentElement && d.remove()},5000);
    }
}

// Navegación
window.goBackToDocuments = function(){
    try{
        sessionStorage.removeItem('uploadedFiles');
        sessionStorage.removeItem('uploadedUrls'); // ⬅️ limpiar también URLs
        sessionStorage.removeItem('extractedCompanyInfo');
        sessionStorage.removeItem('validationSummary');
    }catch(e){ console.error('Error limpiando sessionStorage:', e);}
    window.location.href = '../index.html';
};
window.regresarADocumentos = function(){ window.goBackToDocuments(); };

// Inicializar cuando Firebase esté listo
document.addEventListener('DOMContentLoaded', function(){
    const waitForFirebase = () => {
        if (window.firebase && window.firebaseDB) {
            window.contactOnlyHandler = new ContactOnlyHandler();
            // init es async; no hace falta await aquí
            window.contactOnlyHandler.init();
        } else {
            setTimeout(waitForFirebase, 100);
        }
    };
    waitForFirebase();

    // Respaldo para el botón Regresar
    setTimeout(() => {
        const backButton = document.querySelector('button[onclick="goBackToDocuments()"]');
        if (backButton) {
            backButton.addEventListener('click', function(e){
                e.preventDefault(); window.goBackToDocuments();
            });
        }
    }, 500);
});

// Exportar
window.ContactOnlyHandler = ContactOnlyHandler;
