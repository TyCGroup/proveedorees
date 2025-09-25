// Geographic Coverage Handler
class GeographicCoverageHandler {
    constructor() {
        this.selectedCoverage = [];
        this.states = [];
        this.municipalitiesByState = {};
        this.isLoading = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.fullMexicoData = null; // Datos completos de México.json
    }

    // Initialize the geographic coverage component
    async initialize() {
        await this.loadStates();
        this.setupEventListeners();
    }

    // Load Mexican states from Mexico.json with CORS proxies
    async loadStates() {
        const alternativeUrls = [
            // URL directa (a veces funciona)
            'https://raw.githubusercontent.com/carlosascari/Mexico.json/master/México.json',
            // Proxies CORS gratuitos
            'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://raw.githubusercontent.com/carlosascari/Mexico.json/master/México.json'),
            'https://corsproxy.io/?' + encodeURIComponent('https://raw.githubusercontent.com/carlosascari/Mexico.json/master/México.json'),
            'https://cors-anywhere.herokuapp.com/https://raw.githubusercontent.com/carlosascari/Mexico.json/master/México.json',
            // URL sin acento por si acaso
            'https://raw.githubusercontent.com/carlosascari/Mexico.json/master/Mexico.json',
        ];

        for (let i = 0; i < alternativeUrls.length; i++) {
            const url = alternativeUrls[i];
            try {
                console.log(`Intentando URL ${i + 1}/${alternativeUrls.length}: ${url.substring(0, 50)}...`);
                
                const response = await this.fetchWithRetry(url, 0); // Sin reintentos internos para ser más rápido
                
                if (response && Array.isArray(response)) {
                    // Guardar datos completos para usar después
                    this.fullMexicoData = response;
                    
                    // Extraer solo los estados para el dropdown
                    this.states = response.map(estado => ({
                        cve_ent: estado.clave.padStart(2, '0'),
                        nomgeo: estado.nombre
                    }));
                    
                    console.log(`✅ Estados cargados exitosamente desde URL ${i + 1}: ${this.states.length} estados`);
                    this.populateStateSelect();
                    return; // ¡Éxito! Salir del loop
                } else {
                    throw new Error('Estructura de datos inválida');
                }
            } catch (error) {
                console.warn(`❌ Falló URL ${i + 1}: ${error.message}`);
                
                // Si es la última URL y falló, mostrar error
                if (i === alternativeUrls.length - 1) {
                    console.error('❌ Todas las URLs fallaron');
                    this.showErrorMessage('No se pudieron cargar los datos geográficos desde ninguna fuente disponible. Por favor, intente más tarde.');
                    
                    // Limpiar el estado
                    this.states = [];
                    this.fullMexicoData = null;
                }
            }
        }
        
        this.populateStateSelect();
    }

    // Fetch con reintentos y manejo CORS mejorado
    async fetchWithRetry(url, retries = 2) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            if (retries > 0) {
                console.log(`Reintentando... (${retries} intentos restantes)`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.fetchWithRetry(url, retries - 1);
            }
            
            throw error;
        }
    }

    // Populate state select dropdown
    populateStateSelect() {
        const stateSelect = document.getElementById('state-select');
        if (!stateSelect) return;

        stateSelect.innerHTML = '<option value="">Seleccione un estado</option>';
        
        if (this.states.length === 0) {
            stateSelect.innerHTML += '<option value="" disabled>Error al cargar estados</option>';
            stateSelect.disabled = true;
            return;
        }

        this.states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.cve_ent;
            option.textContent = state.nomgeo;
            stateSelect.appendChild(option);
        });
        
        stateSelect.disabled = false;
    }

    // Load municipalities for selected state from Mexico.json data
    async loadMunicipalities(stateCode) {
        // Si ya los tenemos cargados, usar esos
        if (this.municipalitiesByState[stateCode]) {
            this.populateCitySelect(stateCode);
            return;
        }

        // Si no tenemos datos completos, mostrar error
        if (!this.fullMexicoData) {
            this.showCityError();
            return;
        }

        try {
            this.showCityLoading();
            
            // Buscar el estado en los datos completos
            const estado = this.fullMexicoData.find(e => e.clave.padStart(2, '0') === stateCode);
            
            if (!estado) {
                throw new Error(`Estado con código ${stateCode} no encontrado`);
            }

            if (!estado.municipios || estado.municipios.length === 0) {
                throw new Error(`No hay municipios disponibles para ${estado.nombre}`);
            }

            // Convertir municipios al formato esperado
            this.municipalitiesByState[stateCode] = estado.municipios.map(municipio => ({
                cve_mun: this.extractMunicipalityCode(municipio.clave),
                nomgeo: municipio.nombre,
                clave_completa: municipio.clave // Guardar clave completa por si la necesitamos
            }));

            console.log(`Municipios cargados para ${estado.nombre}: ${this.municipalitiesByState[stateCode].length}`);
            this.populateCitySelect(stateCode);
            
        } catch (error) {
            console.error('Error loading municipalities:', error);
            this.showCityError();
        }
    }

    // Extraer código de municipio de la clave completa (últimos 3 dígitos)
    extractMunicipalityCode(claveCompleta) {
        // La clave viene como string, extraer los últimos 3 dígitos
        const clave = claveCompleta.toString();
        if (clave.length >= 3) {
            return clave.slice(-3);
        }
        return clave.padStart(3, '0');
    }

    // Populate city select dropdown
    populateCitySelect(stateCode) {
        const citySelect = document.getElementById('city-select');
        if (!citySelect) return;

        const municipalities = this.municipalitiesByState[stateCode] || [];
        
        citySelect.innerHTML = '<option value="">Seleccione una ciudad/municipio</option>';
        
        if (municipalities.length === 0) {
            citySelect.innerHTML += '<option value="" disabled>No hay municipios disponibles</option>';
            citySelect.disabled = true;
            return;
        }

        municipalities.forEach(municipality => {
            const option = document.createElement('option');
            option.value = municipality.cve_mun;
            option.textContent = municipality.nomgeo;
            option.dataset.stateName = this.getStateName(stateCode);
            option.dataset.stateCode = stateCode;
            citySelect.appendChild(option);
        });
        
        citySelect.disabled = false;
    }

    // Get state name by code
    getStateName(stateCode) {
        const state = this.states.find(s => s.cve_ent === stateCode);
        return state ? state.nomgeo : '';
    }

    // Setup event listeners
    setupEventListeners() {
        const stateSelect = document.getElementById('state-select');
        const citySelect = document.getElementById('city-select');
        const addLocationBtn = document.getElementById('add-location-btn');

        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                const stateCode = e.target.value;
                if (stateCode) {
                    this.loadMunicipalities(stateCode);
                } else {
                    this.resetCitySelect();
                }
            });
        }

        if (addLocationBtn) {
            addLocationBtn.addEventListener('click', () => {
                this.addSelectedLocation();
            });
        }

        // Enable add button when both state and city are selected
        if (stateSelect && citySelect) {
            [stateSelect, citySelect].forEach(select => {
                select.addEventListener('change', () => {
                    this.updateAddButtonState();
                });
            });
        }
    }

    // Add selected location to the list
    addSelectedLocation() {
        const stateSelect = document.getElementById('state-select');
        const citySelect = document.getElementById('city-select');
        
        if (!stateSelect.value || !citySelect.value) return;

        const stateName = stateSelect.options[stateSelect.selectedIndex].text;
        const cityName = citySelect.options[citySelect.selectedIndex].text;
        const stateCode = stateSelect.value;
        const cityCode = citySelect.value;

        // Check if location already exists
        const exists = this.selectedCoverage.some(loc => 
            loc.stateCode === stateCode && loc.cityCode === cityCode
        );

        if (exists) {
            this.showMessage('Esta ubicación ya ha sido agregada', 'warning');
            return;
        }

        // Add to selected coverage
        const location = {
            id: Date.now(),
            stateCode,
            cityCode,
            stateName,
            cityName,
            fullName: `${cityName}, ${stateName}`
        };

        this.selectedCoverage.push(location);
        this.renderSelectedLocations();
        this.resetSelectors();
        this.updateHiddenInput();
        this.validateCoverage();
    }

    // Render selected locations list
    renderSelectedLocations() {
        const container = document.getElementById('selected-locations');
        if (!container) return;

        if (this.selectedCoverage.length === 0) {
            container.innerHTML = '<p class="no-locations">No ha seleccionado ninguna ubicación</p>';
            return;
        }

        const html = this.selectedCoverage.map(location => `
            <div class="location-item" data-id="${location.id}">
                <div class="location-info">
                    <i class="fas fa-map-marker-alt"></i>
                    <span class="location-name">${location.fullName}</span>
                </div>
                <button type="button" class="remove-location-btn" onclick="geographicHandler.removeLocation(${location.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    // Remove location from list
    removeLocation(locationId) {
        this.selectedCoverage = this.selectedCoverage.filter(loc => loc.id !== locationId);
        this.renderSelectedLocations();
        this.updateHiddenInput();
        this.validateCoverage();
    }

    // Reset selectors
    resetSelectors() {
        const stateSelect = document.getElementById('state-select');
        const citySelect = document.getElementById('city-select');
        
        if (stateSelect) stateSelect.value = '';
        this.resetCitySelect();
        this.updateAddButtonState();
    }

    // Reset city select
    resetCitySelect() {
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Primero seleccione un estado</option>';
            citySelect.disabled = true;
        }
    }

    // Update add button state
    updateAddButtonState() {
        const stateSelect = document.getElementById('state-select');
        const citySelect = document.getElementById('city-select');
        const addBtn = document.getElementById('add-location-btn');
        
        if (addBtn) {
            addBtn.disabled = !stateSelect?.value || !citySelect?.value;
        }
    }

    // Update hidden input for form submission
    updateHiddenInput() {
        const hiddenInput = document.getElementById('ciudades-servicio');
        if (hiddenInput) {
            const locationNames = this.selectedCoverage.map(loc => loc.fullName);
            hiddenInput.value = locationNames.join(', ');
        }
    }

    // Validate coverage
    validateCoverage() {
        const isValid = this.selectedCoverage.length > 0;
        
        // Update validation status in commercial handler
        if (window.commercialConditionsHandler) {
            window.commercialConditionsHandler.validationStatus.ciudadesServicio = isValid;
            window.commercialConditionsHandler.checkOverallCommercialValidation();
        }

        // Show/hide validation message
        this.showValidationMessage(isValid);
    }

    // Show validation message
    showValidationMessage(isValid) {
        const messageContainer = document.getElementById('coverage-validation-message');
        if (!messageContainer) return;

        if (isValid) {
            messageContainer.style.display = 'none';
        } else {
            messageContainer.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                Debe seleccionar al menos una ubicación donde presta servicios
            `;
            messageContainer.className = 'validation-message error';
            messageContainer.style.display = 'block';
        }
    }

    // Show loading state for cities
    showCityLoading() {
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Cargando municipios...</option>';
            citySelect.disabled = true;
        }
    }

    // Show error state for cities
    showCityError() {
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Error: No se pudieron cargar los municipios</option>';
            citySelect.disabled = true;
        }
    }

    // Show error message to user
    showErrorMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'error-message';
        messageDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        `;
        messageDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 1000;
            padding: 15px; border-radius: 4px; color: white;
            background-color: #e74c3c; max-width: 300px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 5000);
    }

    // Show message to user
    showMessage(text, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        messageDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 1000;
            padding: 10px 15px; border-radius: 4px; color: white;
            background-color: ${type === 'warning' ? '#f39c12' : type === 'error' ? '#e74c3c' : '#3498db'};
        `;
        
        document.body.appendChild(messageDiv);
        setTimeout(() => messageDiv.remove(), 3000);
    }

    // Get selected coverage data
    getCoverageData() {
        return {
            locations: this.selectedCoverage,
            formattedString: this.selectedCoverage.map(loc => loc.fullName).join(', '),
            isValid: this.selectedCoverage.length > 0
        };
    }

    // Clear all selections
    clearAll() {
        this.selectedCoverage = [];
        this.renderSelectedLocations();
        this.resetSelectors();
        this.updateHiddenInput();
        this.validateCoverage();
    }

    // Get available municipalities for a state (utility method)
    getMunicipalitiesForState(stateCode) {
        return this.municipalitiesByState[stateCode] || [];
    }

    // Check if data is loaded
    isDataLoaded() {
        return this.fullMexicoData !== null && this.states.length > 0;
    }
}

// Create global instance
window.geographicHandler = new GeographicCoverageHandler();