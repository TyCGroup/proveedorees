// Page Loader for modular HTML structure
class PageLoader {
    constructor() {
        this.currentSection = 'welcome';
        this.loadedComponents = new Set();
        this.baseURL = './sections/';
        this.componentsURL = './sections/components/';
    }

    async init() {
        try {
            // Load essential components first
            await this.loadComponent('header', 'header-container');
            await this.loadComponent('loading', 'loading-container');
            
            // Load initial section
            await this.loadSection('welcome');
            
            console.log('Page loader initialized successfully');
        } catch (error) {
            console.error('Error initializing page loader:', error);
        }
    }

    // Load a component into a container
    async loadComponent(componentName, containerId) {
        if (this.loadedComponents.has(componentName)) {
            return; // Already loaded
        }

        try {
            const response = await fetch(`${this.componentsURL}${componentName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName}`);
            }
            
            const html = await response.text();
            const container = document.getElementById(containerId);
            
            if (container) {
                container.innerHTML = html;
                this.loadedComponents.add(componentName);
                console.log(`Component loaded: ${componentName}`);
            }
        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
        }
    }

    // Load a section into main content
    async loadSection(sectionName) {
        try {
            const response = await fetch(`${this.baseURL}${sectionName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load section: ${sectionName}`);
            }
            
            const html = await response.text();
            const mainContent = document.getElementById('main-content');
            
            if (mainContent) {
                mainContent.innerHTML = html;
                this.currentSection = sectionName;
                
                // Update page title and URL
                this.updatePageState(sectionName);
                
                // Reinitialize event listeners for new content
                this.reinitializeEventListeners(sectionName);
                
                console.log(`Section loaded: ${sectionName}`);
            }
        } catch (error) {
            console.error(`Error loading section ${sectionName}:`, error);
            this.showErrorMessage(`Error cargando la sección: ${sectionName}`);
        }
    }

    // Load form step
    async loadFormStep(stepName) {
        const sectionName = `form/${stepName}`;
        await this.loadSection(sectionName);
    }

    // Update browser state
    updatePageState(sectionName) {
        const titles = {
            welcome: 'Bienvenido - Portal de Socios Comerciales T&C Group',
            declaration: 'Declaración de Responsabilidad - Portal T&C Group',
            'form/documents': 'Documentos - Registro de Proveedor T&C Group',
            'form/company': 'Información de Empresa - Registro de Proveedor T&C Group',
            'form/banking': 'Información Bancaria - Registro de Proveedor T&C Group'
        };
        
        const title = titles[sectionName] || 'Portal de Socios Comerciales T&C Group';
        document.title = title;
        
        // Update URL without reloading
        history.pushState({ section: sectionName }, title, `#${sectionName.replace('/', '-')}`);
    }

    // Reinitialize event listeners after loading new content
    reinitializeEventListeners(sectionName) {
        // Reinitialize form handler listeners if we're in a form section
        if (sectionName.startsWith('form/') && window.formHandler) {
            // Reinitialize specific listeners based on the step
            switch (sectionName) {
                case 'form/documents':
                    window.formHandler.initializeDocumentListeners();
                    break;
                case 'form/banking':
                    window.formHandler.setupBankingListeners();
                    break;
            }
        }

        // Reinitialize declaration checkbox if on declaration page
        if (sectionName === 'declaration' && window.formHandler) {
            const declarationCheckbox = document.getElementById('accept-declaration');
            if (declarationCheckbox) {
                declarationCheckbox.addEventListener('change', 
                    window.formHandler.handleDeclarationChange.bind(window.formHandler));
            }
        }
    }

    // Navigation methods that work with the modular structure
    async showWelcome() {
        await this.loadSection('welcome');
    }

    async showDeclaration() {
        await this.loadSection('declaration');
    }

    async showForm() {
        // Validate declaration acceptance
        const checkbox = document.getElementById('accept-declaration');
        if (!checkbox || !checkbox.checked) {
            this.showErrorMessage('Debe aceptar la Declaración de Responsabilidad para continuar.');
            return;
        }

        await this.loadFormStep('documents');
    }

    async showFormStep(stepName) {
        await this.loadFormStep(stepName);
    }

    // Handle browser navigation
    handlePopState(event) {
        if (event.state && event.state.section) {
            this.loadSection(event.state.section);
        }
    }

    // Show error message
    showErrorMessage(message) {
        // Create error notification
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

        // Add styles if not exist
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

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Global navigation functions that work with the page loader
window.showWelcome = () => window.pageLoader.showWelcome();
window.showDeclaration = () => window.pageLoader.showDeclaration();
window.showForm = () => window.pageLoader.showForm();
window.showFormStep = (stepName) => window.pageLoader.showFormStep(stepName);

// Handle browser back/forward
window.addEventListener('popstate', (event) => {
    if (window.pageLoader) {
        window.pageLoader.handlePopState(event);
    }
});