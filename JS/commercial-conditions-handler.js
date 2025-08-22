// Commercial Conditions Step Handler
class CommercialConditionsHandler {
    constructor() {
        this.commercialData = {
            beneficiosAdicionales: '',
            tiempoRespuesta: '',
            ciudadesServicio: '',
            segmentos: [],
            otroServicio: '',
            personaInvita: ''
        };
        this.validationStatus = {
            tiempoRespuesta: false,
            ciudadesServicio: false,
            segmentos: false
        };
        this.isValid = false;
    }

    // Inicializar eventos cuando se muestra el paso comercial
    initializeCommercialStep() {
        this.setupCommercialEventListeners();
        this.resetCommercialValidation();
        
        // Initialize geographic coverage handler
        if (window.geographicHandler) {
            window.geographicHandler.initialize();
        }
    }


    // Configurar event listeners para el formulario comercial
    setupCommercialEventListeners() {
        // Textarea con contador de caracteres
        const textareas = [
            { id: 'beneficios-adicionales', counter: 'beneficios-char-count', max: 500 },
            { id: 'ciudades-servicio', counter: 'ciudades-char-count', max: 300 },
            { id: 'otro-servicio', counter: 'otro-servicio-char-count', max: 200 }
        ];

        textareas.forEach(({ id, counter, max }) => {
            const textarea = document.getElementById(id);
            const counterElement = document.getElementById(counter);
            
            if (textarea && counterElement) {
                textarea.addEventListener('input', (e) => {
                    this.handleTextareaInput(e, counterElement, max, id);
                });
                
                if (id === 'ciudades-servicio') {
                    textarea.addEventListener('blur', this.validateCiudadesField.bind(this));
                }
            }
        });

        // Select de tiempo de respuesta
        const tiempoSelect = document.getElementById('tiempo-respuesta');
        if (tiempoSelect) {
            tiempoSelect.addEventListener('change', this.handleTiempoRespuestaChange.bind(this));
        }

        // Checkboxes de segmentos
        const segmentCheckboxes = document.querySelectorAll('#provider-segments input[type="checkbox"]');
        segmentCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', this.handleSegmentSelection.bind(this));
        });

        // Campo de persona que invita
        const personaInput = document.getElementById('persona-invita');
        if (personaInput) {
            personaInput.addEventListener('input', this.handlePersonaInvitaInput.bind(this));
        }
    }

    // Manejar entrada de textarea con contador
    handleTextareaInput(event, counterElement, maxLength, fieldId) {
        const textarea = event.target;
        let value = textarea.value;

        // Limitar caracteres
        if (value.length > maxLength) {
            value = value.substring(0, maxLength);
            textarea.value = value;
        }

        // Actualizar contador
        counterElement.textContent = value.length;
        
        // Cambiar color del contador cerca del límite
        if (value.length > maxLength * 0.9) {
            counterElement.style.color = '#ef4444';
        } else if (value.length > maxLength * 0.8) {
            counterElement.style.color = '#f59e0b';
        } else {
            counterElement.style.color = '#6b7280';
        }

        // Actualizar datos
        const fieldMapping = {
            'beneficios-adicionales': 'beneficiosAdicionales',
            'ciudades-servicio': 'ciudadesServicio',
            'otro-servicio': 'otroServicio'
        };

        const dataKey = fieldMapping[fieldId];
        if (dataKey) {
            this.commercialData[dataKey] = value;
        }
    }

    // Manejar cambio en tiempo de respuesta
    handleTiempoRespuestaChange(event) {
        const value = event.target.value;
        this.commercialData.tiempoRespuesta = value;
        
        // Validar campo requerido
        this.validationStatus.tiempoRespuesta = !!value;
        this.showFieldValidation(event.target, !!value, value ? '' : 'Debe seleccionar un tiempo de respuesta');
        
        this.checkOverallCommercialValidation();
    }

    // Validar campo de ciudades
    validateCiudadesField(event) {
        // Si estamos usando el nuevo selector geográfico, validar de manera diferente
        if (window.geographicHandler) {
            const coverageData = window.geographicHandler.getCoverageData();
            this.validationStatus.ciudadesServicio = coverageData.isValid;
            
            if (coverageData.isValid) {
                // Actualizar el campo oculto
                const hiddenInput = document.getElementById('ciudades-servicio');
                if (hiddenInput) {
                    hiddenInput.value = coverageData.formattedString;
                }
                this.commercialData.ciudadesServicio = coverageData.formattedString;
            }
            
            this.checkOverallCommercialValidation();
            return;
        }

        this.validationStatus.ciudadesServicio = isValid;
        this.showFieldValidation(input, isValid, message);
        this.checkOverallCommercialValidation();
    }

    // Manejar selección de segmentos
    handleSegmentSelection(event) {
        const checkedSegments = Array.from(document.querySelectorAll('#provider-segments input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);
        
        this.commercialData.segmentos = checkedSegments;
        this.validateSegmentsField();
    }

    // Validar campo de segmentos
    validateSegmentsField() {
        const selectedSegments = this.commercialData.segmentos;
        let isValid = false;
        let message = '';

        if (!selectedSegments || selectedSegments.length === 0) {
            message = 'Debe seleccionar al menos un segmento de servicios';
        } else {
            isValid = true;
            message = '';
        }

        this.validationStatus.segmentos = isValid;
        this.showSegmentsValidation(isValid, message);
        this.checkOverallCommercialValidation();
    }

    // Manejar entrada de persona que invita
    handlePersonaInvitaInput(event) {
        const input = event.target;
        let value = input.value;

        // Solo letras, espacios, acentos y algunos caracteres especiales
        value = value.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s\.\-]/g, '');
        // No permitir espacios al inicio
        value = value.replace(/^\s+/, '');
        // No permitir múltiples espacios seguidos
        value = value.replace(/\s{2,}/g, ' ');

        input.value = value;
        this.commercialData.personaInvita = value;
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

    // Mostrar validación de segmentos
    showSegmentsValidation(isValid, message) {
        const validationElement = document.getElementById('segmentos-validation');
        
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

    // Verificar validación general del formulario comercial
    checkOverallCommercialValidation() {
        const allFieldsValid = Object.values(this.validationStatus).every(status => status === true);
        
        this.isValid = allFieldsValid;
        
        // Habilitar/deshabilitar botón de continuar
        const nextButton = document.getElementById('commercial-next-btn');
        if (nextButton) {
            nextButton.disabled = !allFieldsValid;
        }

        // Mostrar resultado general
        if (allFieldsValid) {
            this.showCommercialValidationResults(true);
        } else {
            this.hideCommercialValidationResults();
        }
    }

    // Mostrar resultados de validación comercial
    showCommercialValidationResults(isValid) {
        const resultsElement = document.getElementById('commercial-validation-results');
        
        if (resultsElement && isValid) {
            resultsElement.style.display = 'block';
        }
    }

    // Ocultar resultados de validación comercial
    hideCommercialValidationResults() {
        const resultsElement = document.getElementById('commercial-validation-results');
        
        if (resultsElement) {
            resultsElement.style.display = 'none';
        }
    }

    // Resetear validación comercial
    resetCommercialValidation() {
        // Resetear estado de validación
        Object.keys(this.validationStatus).forEach(key => {
            this.validationStatus[key] = false;
        });

        // Limpiar mensajes de error
        const errorElements = document.querySelectorAll('#commercial-step .field-error');
        errorElements.forEach(element => {
            element.style.display = 'none';
        });

        // Limpiar clases de validación en inputs
        const inputs = document.querySelectorAll('#commercial-step input, #commercial-step select, #commercial-step textarea');
        inputs.forEach(input => {
            input.classList.remove('valid', 'invalid');
        });

        // Resetear contadores de caracteres
        const counters = ['beneficios-char-count', 'ciudades-char-count', 'otro-servicio-char-count'];
        counters.forEach(counterId => {
            const counter = document.getElementById(counterId);
            if (counter) {
                counter.textContent = '0';
                counter.style.color = '#6b7280';
            }
        });

        // Ocultar resultados de validación
        this.hideCommercialValidationResults();
        
        // Deshabilitar botón
        const nextButton = document.getElementById('commercial-next-btn');
        if (nextButton) {
            nextButton.disabled = true;
        }

        this.isValid = false;
    }

    // Obtener datos comerciales para envío
    getCommercialData() {
        return {
            ...this.commercialData,
            validationStatus: { ...this.validationStatus },
            isValid: this.isValid
        };
    }

    // Validar todos los campos del formulario comercial
    validateAllCommercialFields() {
        // Validar tiempo de respuesta
        const tiempoSelect = document.getElementById('tiempo-respuesta');
        if (tiempoSelect) {
            this.handleTiempoRespuestaChange({ target: tiempoSelect });
        }

        // Validar ciudades
        const ciudadesTextarea = document.getElementById('ciudades-servicio');
        if (ciudadesTextarea) {
            this.validateCiudadesField({ target: ciudadesTextarea });
        }

        // Validar segmentos
        this.validateSegmentsField();

        return this.isValid;
    }

    // Limpiar formulario comercial
    clearCommercialForm() {
        // Limpiar datos
        this.commercialData = {
            beneficiosAdicionales: '',
            tiempoRespuesta: '',
            ciudadesServicio: '',
            segmentos: [],
            otroServicio: '',
            personaInvita: ''
        };

        // Limpiar campos del formulario
        const textInputs = document.querySelectorAll('#commercial-step input[type="text"], #commercial-step textarea');
        textInputs.forEach(input => {
            input.value = '';
        });

        // Resetear select
        const selectElement = document.getElementById('tiempo-respuesta');
        if (selectElement) {
            selectElement.value = '';
        }

        // Desmarcar checkboxes
        const checkboxes = document.querySelectorAll('#commercial-step input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Resetear validación
        this.resetCommercialValidation();
    }

    // Obtener resumen comercial para confirmación
    getCommercialSummary() {
        // Mapear valores de tiempo de respuesta para mostrar
        const tiempoLabels = {
            'inmediato': 'Inmediato (menos de 1 hora)',
            '2-4-horas': '2-4 horas',
            'mismo-dia': 'Mismo día (hasta 8 horas)',
            '24-horas': '24 horas',
            '48-horas': '48 horas',
            '3-5-dias': '3-5 días hábiles',
            'mas-5-dias': 'Más de 5 días hábiles'
        };

        // Mapear valores de segmentos para mostrar
        const segmentLabels = {
            'activaciones-team-building': 'Activaciones / Team Building',
            'aire-acondicionado-planta-luz': 'Aire Acondicionado / Planta de Luz / Red eléctrica',
            'alimentos-bebidas': 'Proveedor de Alimentos y Bebidas',
            'comercio-online': 'Comercio en línea',
            'aplicaciones-moviles': 'Aplicaciones Móviles',
            'arreglos-florales': 'Arreglos Florales',
            'audiovisual': 'Audiovisual',
            'banderas': 'Banderas',
            'capacitacion': 'Capacitación',
            'carpas-lonas-velarias': 'Carpas / Lonas / Velarias',
            'centros-convenciones': 'Centros de Convenciones',
            'centros-recreativos': 'Centros recreativos',
            'consultoria': 'Consultoría',
            'cruceros': 'Cruceros',
            'dmc': 'DMC',
            'edecanes-gios': 'Edecanes / Gios',
            'escenografia-senalizacion': 'Escenografía / Señalización',
            'espectaculos-talento': 'Espectáculos / Talento artístico',
            'exposicion': 'Exposición',
            'fiestas-tematicas': 'Fiestas temáticas',
            'fotografia-video': 'Fotografía y video',
            'hospedaje': 'Hospedaje',
            'impresiones-diseno': 'Impresiones / Diseño',
            'internet': 'Internet',
            'interpretacion-traduccion': 'Interpretación simultánea / Traducción / Estenógrafo',
            'mobiliario': 'Mobiliario',
            'ocv-gobierno': 'OCV / Oficina de Gobierno',
            'produccion': 'Producción',
            'promocionales-regalos': 'Promocionales /Regalos',
            'agencia-viajes': 'Proveedores de Agencia de Viajes (Aerolíneas, Globalizadores, BSP Único)',
            'legales-administrativos': 'Proveedores legales y administrativos',
            'recursos-humanos': 'Proveedores Recursos Humanos',
            'publicidad': 'Publicidad',
            'recintos': 'Recintos',
            'registro': 'Registro',
            'renta-banos': 'Renta de baños',
            'restaurantes': 'Restaurantes',
            'seguridad': 'Seguridad (Arcos de seguridad, Máquinas de rayos X)',
            'seguros': 'Seguros',
            'limpieza': 'Servicio de limpieza',
            'mensajeria-paqueteria': 'Servicio de mensajería y paquetería',
            'servicios-medicos': 'Servicios médicos y de emergencias',
            'speaker-moderadores': 'Speaker / Moderadores',
            'staff': 'Staff',
            'stands': 'Stands',
            'sustentabilidad': 'Sustentabilidad',
            'tecnologia-software': 'Tecnología y software',
            'transporte': 'Transporte',
            'valet-parking': 'Valet Parking'
        };

        return {
            beneficiosAdicionales: this.commercialData.beneficiosAdicionales || 'No especificado',
            tiempoRespuesta: tiempoLabels[this.commercialData.tiempoRespuesta] || 'No especificado',
            ciudadesServicio: this.commercialData.ciudadesServicio || 'No especificado',
            segmentos: this.commercialData.segmentos.map(seg => segmentLabels[seg] || seg),
            otroServicio: this.commercialData.otroServicio || 'No especificado',
            personaInvita: this.commercialData.personaInvita || 'No especificado'
        };
    }
}

// Crear instancia global del manejador comercial
window.commercialConditionsHandler = new CommercialConditionsHandler();