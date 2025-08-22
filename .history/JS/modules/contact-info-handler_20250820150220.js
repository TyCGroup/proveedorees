// Contact Info Handler Module
export class ContactInfoHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.contactData = {
            representanteLegal: {
                nombre: '',
                apellidos: '',
                telefono: '',
                email: '',
                cargo: ''
            },
            contactoComercial: {
                nombre: '',
                apellidos: '',
                telefono: '',
                email: '',
                cargo: ''
            },
            contactoFacturacion: {
                nombre: '',
                apellidos: '',
                telefono: '',
                email: '',
                departamento: ''
            },
            direccionEntrega: {
                calle: '',
                numero: '',
                colonia: '',
                ciudad: '',
                estado: '',
                cp: '',
                referencias: ''
            }
        };
        this.validationStatus = {
            representanteLegal: false,
            contactoComercial: false,
            contactoFacturacion: false,
            direccionEntrega: false
        };
    }

    initialize() {
        // Will be setup when contact step is shown
    }

    setupListeners() {
        // Setup listeners for all contact form fields
        this.setupRepresentanteLegalListeners();
        this.setupContactoComercialListeners();
        this.setupContactoFacturacionListeners();
        this.setupDireccionEntregaListeners();
    }

    setupRepresentanteLegalListeners() {
        const fields = ['rep-legal-nombre', 'rep-legal-apellidos', 'rep-legal-telefono', 'rep-legal-email', 'rep-legal-cargo'];
        
        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', this.handleRepresentanteLegalInput.bind(this));
                input.addEventListener('blur', this.validateRepresentanteLegal.bind(this));
            }
        });
    }

    setupContactoComercialListeners() {
        const fields = ['contacto-comercial-nombre', 'contacto-comercial-apellidos', 'contacto-comercial-telefono', 'contacto-comercial-email', 'contacto-comercial-cargo'];
        
        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', this.handleContactoComercialInput.bind(this));
                input.addEventListener('blur', this.validateContactoComercial.bind(this));
            }
        });
    }

    setupContactoFacturacionListeners() {
        const fields = ['contacto-facturacion-nombre', 'contacto-facturacion-apellidos', 'contacto-facturacion-telefono', 'contacto-facturacion-email', 'contacto-facturacion-departamento'];
        
        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', this.handleContactoFacturacionInput.bind(this));
                input.addEventListener('blur', this.validateContactoFacturacion.bind(this));
            }
        });
    }

    setupDireccionEntregaListeners() {
        const fields = ['direccion-calle', 'direccion-numero', 'direccion-colonia', 'direccion-ciudad', 'direccion-estado', 'direccion-cp', 'direccion-referencias'];
        
        fields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', this.handleDireccionEntregaInput.bind(this));
                input.addEventListener('blur', this.validateDireccionEntrega.bind(this));
            }
        });
    }

    handleRepresentanteLegalInput(event) {
        const input = event.target;
        const fieldName = this.getFieldNameFromId(input.id, 'rep-legal-');
        
        let value = input.value;
        
        // Apply field-specific validation
        if (fieldName === 'telefono') {
            value = this.formatPhoneNumber(value);
        } else if (fieldName === 'email') {
            value = value.toLowerCase().trim();
        } else if (fieldName === 'nombre' || fieldName === 'apellidos') {
            value = this.formatName(value);
        }
        
        input.value = value;
        this.contactData.representanteLegal[fieldName] = value;
    }

    handleContactoComercialInput(event) {
        const input = event.target;
        const fieldName = this.getFieldNameFromId(input.id, 'contacto-comercial-');
        
        let value = input.value;
        
        if (fieldName === 'telefono') {
            value = this.formatPhoneNumber(value);
        } else if (fieldName === 'email') {
            value = value.toLowerCase().trim();
        } else if (fieldName === 'nombre' || fieldName === 'apellidos') {
            value = this.formatName(value);
        }
        
        input.value = value;
        this.contactData.contactoComercial[fieldName] = value;
    }

    handleContactoFacturacionInput(event) {
        const input = event.target;
        const fieldName = this.getFieldNameFromId(input.id, 'contacto-facturacion-');
        
        let value = input.value;
        
        if (fieldName === 'telefono') {
            value = this.formatPhoneNumber(value);
        } else if (fieldName === 'email') {
            value = value.toLowerCase().trim();
        } else if (fieldName === 'nombre' || fieldName === 'apellidos') {
            value = this.formatName(value);
        }
        
        input.value = value;
        this.contactData.contactoFacturacion[fieldName] = value;
    }

    handleDireccionEntregaInput(event) {
        const input = event.target;
        const fieldName = this.getFieldNameFromId(input.id, 'direccion-');
        
        let value = input.value;
        
        if (fieldName === 'cp') {
            value = value.replace(/\D/g, '').slice(0, 5);
        }
        
        input.value = value;
        this.contactData.direccionEntrega[fieldName] = value;
    }

    getFieldNameFromId(id, prefix) {
        return id.replace(prefix, '');
    }

    formatPhoneNumber(phone) {
        return phone.replace(/[^\d\s\-\+\(\)]/g, '');
    }

    formatName(name) {
        return name.replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '');
    }

    validateRepresentanteLegal() {
        const data = this.contactData.representanteLegal;
        const errors = [];
        
        if (!data.nombre || data.nombre.trim().length < 2) {
            errors.push('Nombre del representante legal requerido');
        }
        
        if (!data.apellidos || data.apellidos.trim().length < 2) {
            errors.push('Apellidos del representante legal requeridos');
        }
        
        if (!data.telefono || !this.isValidPhone(data.telefono)) {
            errors.push('Teléfono del representante legal inválido');
        }
        
        if (!data.email || !this.isValidEmail(data.email)) {
            errors.push('Email del representante legal inválido');
        }
        
        if (!data.cargo || data.cargo.trim().length < 2) {
            errors.push('Cargo del representante legal requerido');
        }
        
        this.validationStatus.representanteLegal = errors.length === 0;
        this.showSectionValidation('representante-legal', this.validationStatus.representanteLegal, errors);
        
        return this.validationStatus.representanteLegal;
    }

    validateContactoComercial() {
        const data = this.contactData.contactoComercial;
        const errors = [];
        
        if (!data.nombre || data.nombre.trim().length < 2) {
            errors.push('Nombre del contacto comercial requerido');
        }
        
        if (!data.apellidos || data.apellidos.trim().length < 2) {
            errors.push('Apellidos del contacto comercial requeridos');
        }
        
        if (!data.telefono || !this.isValidPhone(data.telefono)) {
            errors.push('Teléfono del contacto comercial inválido');
        }
        
        if (!data.email || !this.isValidEmail(data.email)) {
            errors.push('Email del contacto comercial inválido');
        }
        
        this.validationStatus.contactoComercial = errors.length === 0;
        this.showSectionValidation('contacto-comercial', this.validationStatus.contactoComercial, errors);
        
        return this.validationStatus.contactoComercial;
    }

    validateContactoFacturacion() {
        const data = this.contactData.contactoFacturacion;
        const errors = [];
        
        if (!data.nombre || data.nombre.trim().length < 2) {
            errors.push('Nombre del contacto de facturación requerido');
        }
        
        if (!data.email || !this.isValidEmail(data.email)) {
            errors.push('Email del contacto de facturación inválido');
        }
        
        this.validationStatus.contactoFacturacion = errors.length === 0;
        this.showSectionValidation('contacto-facturacion', this.validationStatus.contactoFacturacion, errors);
        
        return this.validationStatus.contactoFacturacion;
    }

    validateDireccionEntrega() {
        const data = this.contactData.direccionEntrega;
        const errors = [];
        
        if (!data.calle || data.calle.trim().length < 3) {
            errors.push('Calle de dirección de entrega requerida');
        }
        
        if (!data.ciudad || data.ciudad.trim().length < 2) {
            errors.push('Ciudad requerida');
        }
        
        if (!data.estado || data.estado.trim().length < 2) {
            errors.push('Estado requerido');
        }
        
        if (!data.cp || data.cp.length !== 5) {
            errors.push('Código postal debe tener 5 dígitos');
        }
        
        this.validationStatus.direccionEntrega = errors.length === 0;
        this.showSectionValidation('direccion-entrega', this.validationStatus.direccionEntrega, errors);
        
        return this.validationStatus.direccionEntrega;
    }

    isValidPhone(phone) {
        const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
        return /^\d{10,}$/.test(cleanPhone);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showSectionValidation(sectionId, isValid, errors) {
        const section = document.getElementById(`${sectionId}-section`);
        if (!section) return;
        
        let validationDiv = section.querySelector('.section-validation');
        if (!validationDiv) {
            validationDiv = document.createElement('div');
            validationDiv.className = 'section-validation';
            section.appendChild(validationDiv);
        }
        
        if (isValid) {
            validationDiv.className = 'section-validation success';
            validationDiv.innerHTML = '<i class="fas fa-check-circle"></i> Información válida';
        } else if (errors.length > 0) {
            validationDiv.className = 'section-validation error';
            validationDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errors.join(', ')}`;
        }
    }

    isValid() {
        return this.validationStatus.representanteLegal && 
               this.validationStatus.contactoComercial && 
               this.validationStatus.contactoFacturacion && 
               this.validationStatus.direccionEntrega;
    }

    getFormData() {
        return { ...this.contactData };
    }

    reset() {
        this.contactData = {
            representanteLegal: {
                nombre: '',
                apellidos: '',
                telefono: '',
                email: '',
                cargo: ''
            },
            contactoComercial: {
                nombre: '',
                apellidos: '',
                telefono: '',
                email: '',
                cargo: ''
            },
            contactoFacturacion: {
                nombre: '',
                apellidos: '',
                telefono: '',
                email: '',
                departamento: ''
            },
            direccionEntrega: {
                calle: '',
                numero: '',
                colonia: '',
                ciudad: '',
                estado: '',
                cp: '',
                referencias: ''
            }
        };
        this.validationStatus = {
            representanteLegal: false,
            contactoComercial: false,
            contactoFacturacion: false,
            direccionEntrega: false
        };
    }