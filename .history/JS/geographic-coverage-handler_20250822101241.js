// Geographic Coverage Handler
class GeographicCoverageHandler {
    constructor() {
        this.selectedCoverage = [];
        this.states = [];
        this.municipalitiesByState = {};
        this.isLoading = false;
    }

    // Initialize the geographic coverage component
    async initialize() {
        await this.loadStates();
        this.setupEventListeners();
    }

    // Load Mexican states from INEGI API
    async loadStates() {
        try {
            this.isLoading = true;
            const response = await fetch('https://gaia.inegi.org.mx/wscatgeo/v2/mgee/');
            const data = await response.json();
            this.states = data.datos || [];
            this.populateStateSelect();
        } catch (error) {
            console.error('Error loading states:', error);
            this.showFallbackStates();
        } finally {
            this.isLoading = false;
        }
    }

    // Populate state select dropdown
    populateStateSelect() {
        const stateSelect = document.getElementById('state-select');
        if (!stateSelect) return;

        stateSelect.innerHTML = '<option value="">Seleccione un estado</option>';
        
        this.states.forEach(state => {
            const option = document.createElement('option');
            option.value = state.cve_ent;
            option.textContent = state.nomgeo; // Cambiado de nom_ent a nomgeo
            stateSelect.appendChild(option);
        });
    }

    // Load municipalities for selected state
    async loadMunicipalities(stateCode) {
        if (this.municipalitiesByState[stateCode]) {
            this.populateCitySelect(stateCode);
            return;
        }

        try {
            this.showCityLoading();
            const response = await fetch(`https://gaia.inegi.org.mx/wscatgeo/v2/mgem/${stateCode}`);
            const data = await response.json();
            this.municipalitiesByState[stateCode] = data.datos || [];
            this.populateCitySelect(stateCode);
        } catch (error) {
            console.error('Error loading municipalities:', error);
            this.showCityError();
        }
    }

    // Populate city select dropdown
    populateCitySelect(stateCode) {
        const citySelect = document.getElementById('city-select');
        if (!citySelect) return;

        citySelect.innerHTML = '<option value="">Seleccione una ciudad/municipio</option>';
        citySelect.disabled = false;
        
        const municipalities = this.municipalitiesByState[stateCode] || [];
        municipalities.forEach(municipality => {
            const option = document.createElement('option');
            option.value = municipality.cve_mun;
            option.textContent = municipality.nomgeo; // Ahora sabemos que siempre es nomgeo
            option.dataset.stateName = this.getStateName(stateCode);
            option.dataset.stateCode = stateCode;
            citySelect.appendChild(option);
        });
    }

    // Get state name by code
    getStateName(stateCode) {
        const state = this.states.find(s => s.cve_ent === stateCode);
        return state ? state.nomgeo : ''; // Cambiado de nom_ent a nomgeo
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
            citySelect.innerHTML = '<option value="">Cargando ciudades...</option>';
            citySelect.disabled = true;
        }
    }

    // Show error state for cities
    showCityError() {
        const citySelect = document.getElementById('city-select');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Error al cargar ciudades</option>';
            citySelect.disabled = true;
        }
    }

    // Show message to user
    showMessage(text, type = 'info') {
        // You can implement a toast/notification system here
        console.log(`${type.toUpperCase()}: ${text}`);
    }

    // Fallback states if API fails
    showFallbackStates() {
        this.states = [
            { cve_ent: '09', nomgeo: 'Ciudad de México' },
            { cve_ent: '15', nomgeo: 'México' },
            { cve_ent: '14', nomgeo: 'Jalisco' },
            { cve_ent: '19', nomgeo: 'Nuevo León' },
            { cve_ent: '23', nomgeo: 'Quintana Roo' }
        ];
        this.populateStateSelect();
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
}

// Create global instance
window.geographicHandler = new GeographicCoverageHandler();