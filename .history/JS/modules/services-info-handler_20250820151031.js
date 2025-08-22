// Services Info Handler Module
export class ServicesInfoHandler {
    constructor(formHandler) {
        this.formHandler = formHandler;
        this.servicesData = {
            categoriasPrincipales: [],
            descripcionServicios: '',
            experienciaAnios: '',
            capacidadMensual: '',
            certificaciones: [],
            equipoTecnologia: '',
            cobertura: {
                nacional: false,
                internacional: false,
                ciudades: []
            },
            referencias: [],
            condicionesComerciales: {
                tiempoPago: '',
                formaPago: '',
                monedaPreferida: '',
                descuentos: '',
                garantias: ''
            }
        };
        this.validationStatus = {
            servicios: false,
            referencias: false,
            condiciones: false
        };
    }

    initialize() {
        // Will be setup when services step is shown
    }

    setupListeners() {
        this.setupServicesListeners();
        this.setupReferenciasListeners();
        this.setupCondicionesListeners();
        this.setupCoberturaListeners();
    }

    setupServicesListeners() {
        // Service categories checkboxes
        const categoriesCheckboxes = document.querySelectorAll('input[name="categoria-servicio"]');
        categoriesCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleCategoriaChange.bind(this));
        });

        // Service description
        const descripcionTextarea = document.getElementById('descripcion-servicios');
        if (descripcionTextarea) {
            descripcionTextarea.addEventListener('input', this.handleDescripcionChange.bind(this));
            descripcionTextarea.addEventListener('blur', this.validateServicios.bind(this));
        }

        // Experience years
        const experienciaInput = document.getElementById('experiencia-anios');
        if (experienciaInput) {
            experienciaInput.addEventListener('input', this.handleExperienciaChange.bind(this));
        }

        // Monthly capacity
        const capacidadInput = document.getElementById('capacidad-mensual');
        if (capacidadInput) {
            capacidadInput.addEventListener('input', this.handleCapacidadChange.bind(this));
        }

        // Certifications
        const certificacionesCheckboxes = document.querySelectorAll('input[name="certificaciones"]');
        certificacionesCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleCertificacionChange.bind(this));
        });

        // Equipment/Technology
        const equipoTextarea = document.getElementById('equipo-tecnologia');
        if (equipoTextarea) {
            equipoTextarea.addEventListener('input', this.handleEquipoChange.bind(this));
        }
    }

    setupReferenciasListeners() {
        // Add reference button
        const addRefBtn = document.getElementById('add-referencia-btn');
        if (addRefBtn) {
            addRefBtn.addEventListener('click', this.addReferencia.bind(this));
        }

        // Upload references file
        const referenciaFileInput = document.getElementById('referencias-file');
        if (referenciaFileInput) {
            referenciaFileInput.addEventListener('change', this.handleReferenciasFileUpload.bind(this));
        }
    }

    setupCondicionesListeners() {
        const condicionesFields = ['tiempo-pago', 'forma-pago', 'moneda-preferida', 'descuentos', 'garantias'];
        
        condicionesFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', this.handleCondicionesChange.bind(this));
                input.addEventListener('blur', this.validateCondiciones.bind(this));
            }
        });
    }

    setupCoberturaListeners() {
        // National/International coverage
        const nacionalCheckbox = document.getElementById('cobertura-nacional');
        const internacionalCheckbox = document.getElementById('cobertura-internacional');
        
        if (nacionalCheckbox) {
            nacionalCheckbox.addEventListener('change', this.handleCoberturaChange.bind(this));
        }
        
        if (internacionalCheckbox) {
            internacionalCheckbox.addEventListener('change', this.handleCoberturaChange.bind(this));
        }

        // Cities input
        const ciudadesInput = document.getElementById('ciudades-cobertura');
        if (ciudadesInput) {
            ciudadesInput.addEventListener('input', this.handleCiudadesChange.bind(this));
        }
    }

    handleCategoriaChange(event) {
        const categoria = event.target.value;
        
        if (event.target.checked) {
            if (!this.servicesData.categoriasPrincipales.includes(categoria)) {
                this.servicesData.categoriasPrincipales.push(categoria);
            }
        } else {
            this.servicesData.categoriasPrincipales = this.servicesData.categoriasPrincipales.filter(c => c !== categoria);
        }
        
        this.validateServicios();
    }

    handleDescripcionChange(event) {
        this.servicesData.descripcionServicios = event.target.value;
    }

    handleExperienciaChange(event) {
        let value = event.target.value.replace(/\D/g, '');
        if (value > 100) value = '100'; // Reasonable max
        
        event.target.value = value;
        this.servicesData.experienciaAnios = value;
    }

    handleCapacidadChange(event) {
        this.servicesData.capacidadMensual = event.target.value;
    }

    handleCertificacionChange(event) {
        const certificacion = event.target.value;
        
        if (event.target.checked) {
            if (!this.servicesData.certificaciones.includes(certificacion)) {
                this.servicesData.certificaciones.push(certificacion);
            }
        } else {
            this.servicesData.certificaciones = this.servicesData.certificaciones.filter(c => c !== certificacion);
        }
    }

    handleEquipoChange(event) {
        this.servicesData.equipoTecnologia = event.target.value;
    }

    handleCoberturaChange(event) {
        const field = event.target.id.replace('cobertura-', '');
        this.servicesData.cobertura[field] = event.target.checked;
    }

    handleCiudadesChange(event) {
        const ciudades = event.target.value.split(',').map(ciudad => ciudad.trim()).filter(ciudad => ciudad.length > 0);
        this.servicesData.cobertura.ciudades = ciudades;
    }

    handleCondicionesChange(event) {
        const fieldName = event.target.id.replace('-', '').replace('tiempo', 'tiempo').replace('forma', 'forma').replace('moneda', 'moneda');
        const mapping = {
            'tiempopago': 'tiempoPago',
            'formapago': 'formaPago',
            'monedapreferida': 'monedaPreferida',
            'descuentos': 'descuentos',
            'garantias': 'garantias'
        };
        
        const key = mapping[fieldName.replace('-', '')] || fieldName;
        this.servicesData.condicionesComerciales[key] = event.target.value;
    }

    addReferencia() {
        const referenciaTemplate = `
            <div class="referencia-item">
                <div class="form-row">
                    <div class="form-group">
                        <label>Empresa/Cliente</label>
                        <input type="text" class="ref-empresa" placeholder="Nombre de la empresa">
                    </div>
                    <div class="form-group">
                        <label>Contacto</label>
                        <input type="text" class="ref-contacto" placeholder="Nombre del contacto">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Teléfono</label>
                        <input type="tel" class="ref-telefono" placeholder="Teléfono de contacto">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" class="ref-email" placeholder="Email de contacto">
                    </div>
                </div>
                <div class="form-group">
                    <label>Descripción del servicio prestado</label>
                    <textarea class="ref-descripcion" placeholder="Describe el servicio que prestaste a este cliente" rows="2"></textarea>
                </div>
                <button type="button" class="btn btn-danger btn-sm remove-referencia" onclick="this.parentElement.remove()">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        `;
        
        const referenciasContainer = document.getElementById('referencias-container');
        if (referenciasContainer) {
            referenciasContainer.insertAdjacentHTML('beforeend', referenciaTemplate);
            this.setupReferenciaListeners();
        }
    }

    setupReferenciaListeners() {
        const referenciaItems = document.querySelectorAll('.referencia-item');
        referenciaItems.forEach(item => {
            const inputs = item.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.removeEventListener('blur', this.validateReferencias.bind(this));
                input.addEventListener('blur', this.validateReferencias.bind(this));
            });
        });
    }

    handleReferenciasFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            this.showError('El archivo debe ser PDF o Word (.doc, .docx)');
            event.target.value = '';
            return;
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError('El archivo no debe exceder 5MB');
            event.target.value = '';
            return;
        }

        // Show file info
        this.showReferenciaFileInfo(file);
    }

    showReferenciaFileInfo(file) {
        const fileInfo = document.getElementById('referencia-file-info');
        if (fileInfo) {
            fileInfo.innerHTML = `
                <div class="file-uploaded">
                    <i class="fas fa-file-alt"></i>
                    <span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
            `;
            fileInfo.style.display = 'block';
        }
    }

    validateServicios() {
        const errors = [];
        
        if (this.servicesData.categoriasPrincipales.length === 0) {
            errors.push('Debe seleccionar al menos una categoría de servicio');
        }
        
        if (!this.servicesData.descripcionServicios || this.servicesData.descripcionServicios.trim().length < 50) {
            errors.push('La descripción de servicios debe tener al menos 50 caracteres');
        }
        
        if (!this.servicesData.experienciaAnios || parseInt(this.servicesData.experienciaAnios) < 1) {
            errors.push('Debe especificar los años de experiencia');
        }
        
        this.validationStatus.servicios = errors.length === 0;
        this.showValidationMessage('servicios', this.validationStatus.servicios, errors);
        
        return this.validationStatus.servicios;
    }

    validateReferencias() {
        const referenciaItems = document.querySelectorAll('.referencia-item');
        const referencias = [];
        
        referenciaItems.forEach(item => {
            const empresa = item.querySelector('.ref-empresa').value;
            const contacto = item.querySelector('.ref-contacto').value;
            const telefono = item.querySelector('.ref-telefono').value;
            const email = item.querySelector('.ref-email').value;
            const descripcion = item.querySelector('.ref-descripcion').value;
            
            if (empresa && contacto && (telefono || email)) {
                referencias.push({
                    empresa,
                    contacto,
                    telefono,
                    email,
                    descripcion
                });
            }
        });
        
        this.servicesData.referencias = referencias;
        
        // At least 2 valid references required
        this.validationStatus.referencias = referencias.length >= 2;
        
        const errors = [];
        if (referencias.length < 2) {
            errors.push('Se requieren al menos 2 referencias comerciales válidas');
        }
        
        this.showValidationMessage('referencias', this.validationStatus.referencias, errors);
        
        return this.validationStatus.referencias;
    }

    validateCondiciones() {
        const condiciones = this.servicesData.condicionesComerciales;
        const errors = [];
        
        if (!condiciones.tiempoPago) {
            errors.push('Debe especificar los tiempos de pago');
        }
        
        if (!condiciones.formaPago) {
            errors.push('Debe especificar las formas de pago aceptadas');
        }
        
        this.validationStatus.condiciones = errors.length === 0;
        this.showValidationMessage('condiciones', this.validationStatus.condiciones, errors);
        
        return this.validationStatus.condiciones;
    }

    showValidationMessage(section, isValid, errors) {
        const container = document.getElementById(`${section}-validation`);
        if (!container) return;
        
        if (isValid) {
            container.className = 'validation-message success';
            container.innerHTML = '<i class="fas fa-check-circle"></i> Información válida';
        } else if (errors.length > 0) {
            container.className = 'validation-message error';
            container.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${errors.join(', ')}`;
        }
        
        container.style.display = 'block';
    }

    showError(message) {
        if (window.portalApp) {
            window.portalApp.showErrorMessage(message);
        }
    }

    isValid() {
        // Run all validations
        this.validateServicios();
        this.validateReferencias();
        this.validateCondiciones();
        
        return this.validationStatus.servicios && 
               this.validationStatus.referencias && 
               this.validationStatus.condiciones;
    }

    getFormData() {
        // Collect current form data
        this.validateReferencias(); // Update referencias data
        return { ...this.servicesData };
    }

    reset() {
        this.servicesData = {
            categoriasPrincipales: [],
            descripcionServicios: '',
            experienciaAnios: '',
            capacidadMensual: '',
            certificaciones: [],
            equipoTecnologia: '',
            cobertura: {
                nacional: false,
                internacional: false,
                ciudades: []
            },
            referencias: [],
            condicionesComerciales: {
                tiempoPago: '',
                formaPago: '',
                monedaPreferida: '',
                descuentos: '',
                garantias: ''
            }
        };
        this.validationStatus = {
            servicios: false,
            referencias: false,
            condiciones: false
        };
        
        // Clear form elements
        const serviceStep = document.getElementById('services-step');
        if (serviceStep) {
            const inputs = serviceStep.querySelectorAll('input, textarea, select');
            inputs.forEach(input => {
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            });
        }
        
        // Clear referencias container
        const referenciasContainer = document.getElementById('referencias-container');
        if (referenciasContainer) {
            referenciasContainer.innerHTML = '';
        }
    }
}

// Export the class
export { ServicesInfoHandler };