// Contact Step Handler - Manejador para el paso de datos de contacto
class ContactStepHandler {
    constructor() {
        this.contactData = {
            nombre: '',
            apellido: '',
            cargo: '',
            areas: [],
            celular: '',
            email: ''
        };
        this.validationStatus = {
            nombre: false,
            apellido: false,
            cargo: false,
            areas: false,
            celular: false,
            email: false
        };
        this.isValid = false;
    }

    // Inicializar eventos cuando se muestra el paso de contacto
    initializeContactStep() {
        this.setupContactEventListeners();
        this.resetContactValidation();
    }

    // Configurar event listeners para el formulario de contacto
    setupContactEventListeners() {
        // Campos de texto
        const textFields = ['contacto-nombre', 'contacto-apellido', 'contacto-cargo'];
        textFields.forEach(fieldId => {
            const input = document.getElementById(fieldId);
            if (input) {
                input.addEventListener('input', this.handleTextInput.bind(this));
                input.addEventListener('blur', this.validateTextField.bind(this));
            }
        });

        // Campo de celular
        const celularInput = document.getElementById('contacto-celular');
        if (celularInput) {
            celularInput.addEventListener('input', this.handlePhoneInput.bind(this));
            celularInput.addEventListener('blur', this.validatePhoneField.bind(this));
        }

        // Campo de email
        const emailInput = document.getElementById('contacto-email');
        if (emailInput) {
            emailInput.addEventListener('input', this.handleEmailInput.bind(this));
            emailInput.addEventListener('blur', this.validateEmailField.bind(this));
        }

        // Checkboxes de áreas
        const checkboxes = document.querySelectorAll('#areas-responsabilidad input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleAreaSelection.bind(this));
        });
    }

    // Manejar entrada de texto
    handleTextInput(event) {
        const input = event.target;
        let value = input.value;

        // Validaciones específicas por campo
        switch (input.id) {
            case 'contacto-nombre':
            case 'contacto-apellido':
                // Solo letras, espacios, acentos y guiones
                value = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\-]/g, '');
                // No permitir espacios al inicio
                value = value.replace(/^\s+/, '');
                // No permitir múltiples espacios seguidos
                value = value.replace(/\s{2,}/g, ' ');
                break;
            case 'contacto-cargo':
                // Permitir letras, números, espacios, acentos y algunos símbolos comunes
                value = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\-\.\,\(\)0-9]/g, '');
                value = value.replace(/^\s+/, '');
                value = value.replace(/\s{2,}/g, ' ');
                break;
        }

        input.value = value;
        this.updateContactData(input.id, value);
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
        this.updateContactData('celular', value);
    }

    // Manejar entrada de email
    handleEmailInput(event) {
        const input = event.target;
        let value = input.value.toLowerCase().trim();
        
        input.value = value;
        this.updateContactData('email', value);
    }

    // Manejar selección de áreas
    handleAreaSelection(event) {
        const checkedAreas = Array.from(document.querySelectorAll('#areas-responsabilidad input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        this.updateContactData('areas', checkedAreas);
        this.validateAreasField();
    }

    // Actualizar datos de contacto
    updateContactData(field, value) {
        const fieldMapping = {
            'contacto-nombre': 'nombre',
            'contacto-apellido': 'apellido',
            'contacto-cargo': 'cargo',
            'contacto-celular': 'celular',
            'contacto-email': 'email',
            'areas': 'areas'
        };

        const dataKey = fieldMapping[field] || field;
        this.contactData[dataKey] = value;
    }

    // Validar campo de texto
    validateTextField(event) {
        const input = event.target;
        const value = input.value.trim();
        let isValid = false;
        let message = '';

        const fieldNames = {
            'contacto-nombre': 'nombre',
            'contacto-apellido': 'apellido',
            'contacto-cargo': 'cargo'
        };

        const fieldName = fieldNames[input.id];

        if (!value) {
            message = `El ${fieldName} es requerido`;
        } else if (value.length < 2) {
            message = `El ${fieldName} debe tener al menos 2 caracteres`;
        } else if (input.id === 'contacto-cargo' && value.length < 3) {
            message = 'El cargo debe tener al menos 3 caracteres';
        } else {
            isValid = true;
            message = '';
        }

        this.validationStatus[fieldName] = isValid;
        this.showFieldValidation(input, isValid, message);
        this.checkOverallContactValidation();
    }

    // Validar campo de teléfono
    validatePhoneField(event) {
        const input = event.target;
        const value = input.value.replace(/\D/g, ''); // Solo números
        let isValid = false;
        let message = '';

        if (!value) {
            message = 'El teléfono celular es requerido';
        } else if (value.length < 10) {
            message = 'El teléfono debe tener al menos 10 dígitos';
        } else if (value.length > 15) {
            message = 'El teléfono no puede exceder 15 dígitos';
        } else if (!/^[0-9]{10,15}$/.test(value)) {
            message = 'El teléfono contiene caracteres inválidos';
        } else {
            isValid = true;
            message = '';
        }

        this.validationStatus.celular = isValid;
        this.showFieldValidation(input, isValid, message);
        this.checkOverallContactValidation();
    }

    // Validar campo de email
    validateEmailField(event) {
        const input = event.target;
        const value = input.value.trim();
        let isValid = false;
        let message = '';

        if (!value) {
            message = 'El correo electrónico es requerido';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            message = 'El formato del correo electrónico no es válido';
        } else if (value.length > 100) {
            message = 'El correo electrónico es demasiado largo';
        } else {
            isValid = true;
            message = '';
        }

        this.validationStatus.email = isValid;
        this.showFieldValidation(input, isValid, message);
        this.checkOverallContactValidation();
    }

    // Validar campo de áreas
    validateAreasField() {
        const selectedAreas = this.contactData.areas;
        let isValid = false;
        let message = '';

        if (!selectedAreas || selectedAreas.length === 0) {
            message = 'Debe seleccionar al menos un área de responsabilidad';
        } else {
            isValid = true;
            message = '';
        }

        this.validationStatus.areas = isValid;
        this.showAreasValidation(isValid, message);
        this.checkOverallContactValidation();
    }

    // Mostrar validación de campo individual
    showFieldValidation(input, isValid, message) {
        // Remover clases de validación previas
        input.classList.remove('valid', 'invalid');
        
        // Agregar clase según estado
        if (message) {
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

    // Mostrar validación de áreas
    showAreasValidation(isValid, message) {
        const validationElement = document.getElementById('areas-validation');
        
        if (validationElement) {
            if (message && !isValid) {
                validationElement.className = 'validation-message error';
                validationElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
                validationElement.style.display = 'block';
            } else {
                validationElement.style.display = 'none';
            }
        }
    }

    // Verificar validación general del formulario de contacto
    checkOverallContactValidation() {
        const allFieldsValid = Object.values(this.validationStatus).every(status => status === true);
        
        this.isValid = allFieldsValid;
        
        // Habilitar/deshabilitar botón de continuar
        const nextButton = document.getElementById('contact-next-btn');
        if (nextButton) {
            nextButton.disabled = !allFieldsValid;
        }

        // Mostrar resultado general
        if (allFieldsValid) {
            this.showContactValidationResults(true);
        } else {
            this.hideContactValidationResults();
        }
    }

    // Mostrar resultados de validación de contacto
    showContactValidationResults(isValid) {
        const resultsElement = document.getElementById('contact-validation-results');
        
        if (resultsElement && isValid) {
            resultsElement.style.display = 'block';
        }
    }

    // Ocultar resultados de validación de contacto
    hideContactValidationResults() {
        const resultsElement = document.getElementById('contact-validation-results');
        
        if (resultsElement) {
            resultsElement.style.display = 'none';
        }
    }

    // Resetear validación de contacto
    resetContactValidation() {
        // Resetear estado de validación
        Object.keys(this.validationStatus).forEach(key => {
            this.validationStatus[key] = false;
        });

        // Limpiar mensajes de error
        const errorElements = document.querySelectorAll('#contact-step .field-error');
        errorElements.forEach(element => {
            element.style.display = 'none';
        });

        // Limpiar clases de validación en inputs
        const inputs = document.querySelectorAll('#contact-step input');
        inputs.forEach(input => {
            input.classList.remove('valid', 'invalid');
        });

        // Ocultar resultados de validación
        this.hideContactValidationResults();
        
        // Deshabilitar botón
        const nextButton = document.getElementById('contact-next-btn');
        if (nextButton) {
            nextButton.disabled = true;
        }

        this.isValid = false;
    }

    // Obtener datos de contacto para envío
    getContactData() {
        return {
            ...this.contactData,
            validationStatus: { ...this.validationStatus },
            isValid: this.isValid
        };
    }

    // Validar todos los campos del formulario de contacto
    validateAllContactFields() {
        // Validar campos de texto
        const textFields = [
            { id: 'contacto-nombre', name: 'nombre' },
            { id: 'contacto-apellido', name: 'apellido' },
            { id: 'contacto-cargo', name: 'cargo' }
        ];

        textFields.forEach(field => {
            const input = document.getElementById(field.id);
            if (input) {
                this.validateTextField({ target: input });
            }
        });

        // Validar teléfono
        const phoneInput = document.getElementById('contacto-celular');
        if (phoneInput) {
            this.validatePhoneField({ target: phoneInput });
        }

        // Validar email
        const emailInput = document.getElementById('contacto-email');
        if (emailInput) {
            this.validateEmailField({ target: emailInput });
        }

        // Validar áreas
        this.validateAreasField();

        return this.isValid;
    }

    // Limpiar formulario de contacto
    clearContactForm() {
        // Limpiar datos
        this.contactData = {
            nombre: '',
            apellido: '',
            cargo: '',
            areas: [],
            celular: '',
            email: ''
        };

        // Limpiar campos del formulario
        const inputs = document.querySelectorAll('#contact-step input[type="text"], #contact-step input[type="tel"], #contact-step input[type="email"]');
        inputs.forEach(input => {
            input.value = '';
        });

        // Desmarcar checkboxes
        const checkboxes = document.querySelectorAll('#contact-step input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Resetear validación
        this.resetContactValidation();
    }

    // Obtener resumen de contacto para confirmación
    getContactSummary() {
        const areasLabels = {
            'ventas': 'Ventas',
            'mercadotecnia': 'Mercadotecnia',
            'recursos-humanos': 'Recursos Humanos',
            'compras': 'Área de Compras',
            'operaciones': 'Operaciones'
        };

        return {
            nombreCompleto: `${this.contactData.nombre} ${this.contactData.apellido}`,
            cargo: this.contactData.cargo,
            areas: this.contactData.areas.map(area => areasLabels[area] || area),
            celular: this.contactData.celular,
            email: this.contactData.email
        };
    }
}

// Crear instancia global del manejador de contacto
window.contactStepHandler = new ContactStepHandler();
