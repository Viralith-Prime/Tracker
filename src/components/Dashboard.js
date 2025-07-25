/**
 * Dashboard Component
 * 
 * Main dashboard orchestrator that manages layout, UI state, and
 * coordinates all other components as specified in the blueprint.
 */

import { DOMOptimizer } from '../utils/performance.js';

/**
 * Dashboard component class
 * Manages the main application layout and UI coordination
 */
export class Dashboard {
    constructor(options = {}) {
        this.container = options.container;
        this.store = options.store;
        this.isInitialized = false;
        
        // Component references
        this.components = new Map();
        
        // UI state
        this.sidebarCollapsed = false;
        this.activeTab = 'watchlist';
        this.detailsPanelOpen = false;
        
        // DOM elements
        this.elements = {};
        
        // Event handlers
        this.boundHandlers = {
            handleTabClick: this.handleTabClick.bind(this),
            handleSidebarToggle: this.handleSidebarToggle.bind(this),
            handleSettingsClick: this.handleSettingsClick.bind(this),
            handleMapControlClick: this.handleMapControlClick.bind(this),
            handleCloseDetailsPanel: this.handleCloseDetailsPanel.bind(this)
        };

        console.log('🎛️ Dashboard component initialized');
    }

    /**
     * Initialize the dashboard
     */
    async initialize() {
        try {
            // Render main dashboard layout
            await this.render();
            
            // Cache DOM elements
            this.cacheElements();
            
            // Bind event listeners
            this.bindEventListeners();
            
            // Subscribe to store changes
            this.subscribeToStore();
            
            // Initialize UI state
            this.initializeUIState();
            
            this.isInitialized = true;
            console.log('✅ Dashboard initialized successfully');
            
        } catch (error) {
            console.error('❌ Dashboard initialization failed:', error);
            throw error;
        }
    }

    /**
     * Render the main dashboard layout
     */
    async render() {
        const template = document.getElementById('main-dashboard-template');
        if (!template) {
            throw new Error('Main dashboard template not found');
        }

        // Clone template content
        const content = template.content.cloneNode(true);
        
        // Clear container and append new content
        await DOMOptimizer.replaceContent(this.container, content);
        
        console.log('🎨 Dashboard layout rendered');
    }

    /**
     * Cache frequently accessed DOM elements
     */
    cacheElements() {
        this.elements = {
            // Layout elements
            leftSidebar: this.container.querySelector('.sidebar-left'),
            rightSidebar: this.container.querySelector('.sidebar-right'),
            mapContainer: this.container.querySelector('.map-container'),
            
            // Header elements
            connectionStatus: this.container.querySelector('.connection-status'),
            statusIndicator: this.container.querySelector('.status-indicator'),
            statusText: this.container.querySelector('.status-text'),
            
            // Sidebar navigation
            navTabs: this.container.querySelectorAll('.nav-tab'),
            tabPanels: this.container.querySelectorAll('.tab-panel'),
            sidebarToggle: this.container.querySelector('.sidebar-toggle'),
            
            // Content containers
            watchlistContainer: this.container.querySelector('#watchlist-container'),
            alertsContainer: this.container.querySelector('#alerts-container'),
            geofencesContainer: this.container.querySelector('#geofences-container'),
            aircraftDetailsContent: this.container.querySelector('#aircraft-details-content'),
            
            // Map controls
            mapControls: this.container.querySelectorAll('.map-control-btn'),
            
            // Summary display
            totalAircraft: this.container.querySelector('#total-aircraft'),
            militaryAircraft: this.container.querySelector('#military-aircraft'),
            lastUpdate: this.container.querySelector('#last-update'),
            
            // Counters
            watchlistCount: this.container.querySelector('#watchlist-count'),
            alertCount: this.container.querySelector('#alert-count'),
            
            // Action buttons
            settingsBtn: this.container.querySelector('.settings-btn'),
            createGeofenceBtn: this.container.querySelector('.create-geofence'),
            clearAlertsBtn: this.container.querySelector('.clear-alerts'),
            closeSidebarBtn: this.container.querySelector('.close-sidebar')
        };
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Navigation tabs
        this.elements.navTabs.forEach(tab => {
            tab.addEventListener('click', this.boundHandlers.handleTabClick);
        });
        
        // Sidebar controls
        this.elements.sidebarToggle?.addEventListener('click', this.boundHandlers.handleSidebarToggle);
        this.elements.closeSidebarBtn?.addEventListener('click', this.boundHandlers.handleCloseDetailsPanel);
        
        // Header controls
        this.elements.settingsBtn?.addEventListener('click', this.boundHandlers.handleSettingsClick);
        
        // Map controls
        this.elements.mapControls.forEach(control => {
            control.addEventListener('click', this.boundHandlers.handleMapControlClick);
        });
        
        // Action buttons
        this.elements.createGeofenceBtn?.addEventListener('click', this.handleCreateGeofence.bind(this));
        this.elements.clearAlertsBtn?.addEventListener('click', this.handleClearAlerts.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        
        console.log('🎧 Dashboard event listeners bound');
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        if (!this.store) return;
        
        // Subscribe to connection status changes
        this.store.subscribe('live.connectionStatus', (path, status) => {
            this.updateConnectionStatus(status);
        });
        
        // Subscribe to aircraft data changes
        this.store.subscribe('live.aircraft', (path, aircraftMap) => {
            this.updateAircraftSummary(aircraftMap);
        });
        
        // Subscribe to last update timestamp
        this.store.subscribe('live.lastUpdateTimestamp', (path, timestamp) => {
            this.updateLastUpdateTime(timestamp);
        });
        
        // Subscribe to UI state changes
        this.store.subscribe('ui.activeTab', (path, tab) => {
            this.switchTab(tab);
        });
        
        this.store.subscribe('ui.sidebarCollapsed', (path, collapsed) => {
            this.toggleSidebar(collapsed);
        });
        
        this.store.subscribe('ui.isDetailsPanelOpen', (path, isOpen) => {
            this.toggleDetailsPanel(isOpen);
        });
        
        // Subscribe to watchlist changes
        this.store.subscribe('user.watchlist', (path, watchlist) => {
            this.updateWatchlistCount(watchlist.length);
        });
    }

    /**
     * Initialize UI state from store
     */
    initializeUIState() {
        if (!this.store) return;
        
        const state = this.store.getState();
        
        // Apply initial UI state
        this.updateConnectionStatus(state.live.connectionStatus);
        this.switchTab(state.ui.activeTab);
        this.toggleSidebar(state.ui.sidebarCollapsed);
        this.toggleDetailsPanel(state.ui.isDetailsPanelOpen);
        
        if (state.live.aircraft) {
            this.updateAircraftSummary(state.live.aircraft);
        }
        
        if (state.live.lastUpdateTimestamp) {
            this.updateLastUpdateTime(state.live.lastUpdateTimestamp);
        }
        
        if (state.user.watchlist) {
            this.updateWatchlistCount(state.user.watchlist.length);
        }
    }

    /**
     * Handle tab click events
     */
    handleTabClick(event) {
        const tab = event.currentTarget;
        const tabName = tab.dataset.tab;
        
        if (tabName && this.store) {
            this.store.setState('ui.activeTab', tabName);
        }
    }

    /**
     * Handle sidebar toggle
     */
    handleSidebarToggle() {
        if (this.store) {
            const currentState = this.store.getState().ui.sidebarCollapsed;
            this.store.setState('ui.sidebarCollapsed', !currentState);
        }
    }

    /**
     * Handle settings button click
     */
    handleSettingsClick() {
        // TODO: Implement settings modal
        console.log('Settings clicked');
    }

    /**
     * Handle map control clicks
     */
    handleMapControlClick(event) {
        const control = event.currentTarget;
        const controlId = control.id;
        
        switch (controlId) {
            case 'center-on-aircraft':
                this.centerOnAircraft();
                break;
            case 'toggle-labels':
                this.toggleLabels();
                break;
            case 'toggle-trails':
                this.toggleTrails();
                break;
            case 'toggle-geofence-mode':
                this.toggleGeofenceMode();
                break;
        }
    }

    /**
     * Handle close details panel
     */
    handleCloseDetailsPanel() {
        if (this.store) {
            this.store.setState('ui.isDetailsPanelOpen', false);
            this.store.setState('ui.selectedAircraftHex', null);
        }
    }

    /**
     * Handle create geofence action
     */
    handleCreateGeofence() {
        if (this.store) {
            this.store.setState('ui.geofenceMode', true);
        }
        console.log('Create geofence mode activated');
    }

    /**
     * Handle clear alerts action
     */
    handleClearAlerts() {
        // TODO: Clear all alerts
        console.log('Clear alerts clicked');
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Tab switching (1-3 keys)
        if (event.key >= '1' && event.key <= '3' && !event.ctrlKey && !event.metaKey) {
            const tabs = ['watchlist', 'alerts', 'geofences'];
            const tabIndex = parseInt(event.key) - 1;
            if (tabs[tabIndex] && this.store) {
                this.store.setState('ui.activeTab', tabs[tabIndex]);
            }
        }
        
        // Toggle sidebar with 'S' key
        if (event.key === 's' && !event.ctrlKey && !event.metaKey && 
            !event.target.matches('input, textarea')) {
            event.preventDefault();
            this.handleSidebarToggle();
        }
        
        // Center on aircraft with 'C' key
        if (event.key === 'c' && !event.ctrlKey && !event.metaKey && 
            !event.target.matches('input, textarea')) {
            event.preventDefault();
            this.centerOnAircraft();
        }
    }

    /**
     * Switch active tab
     */
    switchTab(tabName) {
        // Update tab buttons
        this.elements.navTabs.forEach(tab => {
            const isActive = tab.dataset.tab === tabName;
            tab.classList.toggle('active', isActive);
        });
        
        // Update tab panels
        this.elements.tabPanels.forEach(panel => {
            const isActive = panel.dataset.panel === tabName;
            panel.classList.toggle('active', isActive);
        });
        
        this.activeTab = tabName;
    }

    /**
     * Toggle sidebar collapsed state
     */
    toggleSidebar(collapsed) {
        if (this.elements.leftSidebar) {
            this.elements.leftSidebar.dataset.collapsed = collapsed.toString();
        }
        this.sidebarCollapsed = collapsed;
    }

    /**
     * Toggle details panel visibility
     */
    toggleDetailsPanel(isOpen) {
        if (this.elements.rightSidebar) {
            this.elements.rightSidebar.dataset.visible = isOpen.toString();
        }
        this.detailsPanelOpen = isOpen;
    }

    /**
     * Update connection status display
     */
    updateConnectionStatus(status) {
        if (!this.elements.connectionStatus) return;
        
        this.elements.connectionStatus.dataset.status = status;
        
        const statusTexts = {
            connecting: 'Connecting...',
            connected: 'Connected',
            error: 'Connection Error',
            offline: 'Offline',
            switching: 'Switching Source...'
        };
        
        if (this.elements.statusText) {
            this.elements.statusText.textContent = statusTexts[status] || 'Unknown';
        }
    }

    /**
     * Update aircraft summary statistics
     */
    updateAircraftSummary(aircraftMap) {
        if (!aircraftMap) return;
        
        const totalCount = aircraftMap.size;
        let militaryCount = 0;
        
        for (const aircraft of aircraftMap.values()) {
            if (aircraft.military) {
                militaryCount++;
            }
        }
        
        if (this.elements.totalAircraft) {
            this.elements.totalAircraft.textContent = totalCount.toString();
        }
        
        if (this.elements.militaryAircraft) {
            this.elements.militaryAircraft.textContent = militaryCount.toString();
        }
    }

    /**
     * Update last update time display
     */
    updateLastUpdateTime(timestamp) {
        if (!this.elements.lastUpdate || !timestamp) return;
        
        const date = new Date(timestamp);
        const timeString = date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
        
        this.elements.lastUpdate.textContent = timeString;
    }

    /**
     * Update watchlist count
     */
    updateWatchlistCount(count) {
        if (this.elements.watchlistCount) {
            this.elements.watchlistCount.textContent = count.toString();
        }
    }

    /**
     * Center map on aircraft
     */
    centerOnAircraft() {
        // Get map component and center on aircraft
        const mapComponent = this.components.get('map');
        if (mapComponent) {
            mapComponent.fitToAircraft();
        }
    }

    /**
     * Toggle aircraft labels
     */
    toggleLabels() {
        if (this.store) {
            const currentState = this.store.getState().ui.showLabels;
            this.store.setState('ui.showLabels', !currentState);
            
            // Update button state
            const button = this.container.querySelector('#toggle-labels');
            if (button) {
                button.classList.toggle('active', !currentState);
            }
        }
    }

    /**
     * Toggle aircraft trails
     */
    toggleTrails() {
        if (this.store) {
            const currentState = this.store.getState().ui.showTrails;
            this.store.setState('ui.showTrails', !currentState);
            
            // Update button state
            const button = this.container.querySelector('#toggle-trails');
            if (button) {
                button.classList.toggle('active', !currentState);
            }
        }
    }

    /**
     * Toggle geofence drawing mode
     */
    toggleGeofenceMode() {
        if (this.store) {
            const currentState = this.store.getState().ui.geofenceMode;
            this.store.setState('ui.geofenceMode', !currentState);
            
            // Update button state
            const button = this.container.querySelector('#toggle-geofence-mode');
            if (button) {
                button.classList.toggle('active', !currentState);
            }
        }
    }

    /**
     * Register a component with the dashboard
     */
    registerComponent(name, component) {
        this.components.set(name, component);
    }

    /**
     * Get a registered component
     */
    getComponent(name) {
        return this.components.get(name);
    }

    /**
     * Show the dashboard (for router integration)
     */
    show() {
        if (this.container) {
            this.container.style.display = 'flex';
        }
    }

    /**
     * Hide the dashboard
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Notify all registered components
        this.components.forEach(component => {
            if (component.handleResize) {
                component.handleResize();
            }
        });
    }

    /**
     * Update layout for mobile
     */
    updateMobileLayout() {
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile && this.elements.leftSidebar) {
            // On mobile, treat sidebar as overlay
            this.elements.leftSidebar.style.position = 'absolute';
            this.elements.leftSidebar.style.zIndex = '1000';
            
            if (this.sidebarCollapsed) {
                this.elements.leftSidebar.style.transform = 'translateX(-100%)';
            } else {
                this.elements.leftSidebar.style.transform = 'translateX(0)';
            }
        } else if (this.elements.leftSidebar) {
            // Desktop layout
            this.elements.leftSidebar.style.position = 'relative';
            this.elements.leftSidebar.style.transform = 'none';
        }
    }

    /**
     * Get dashboard state for debugging
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            activeTab: this.activeTab,
            sidebarCollapsed: this.sidebarCollapsed,
            detailsPanelOpen: this.detailsPanelOpen,
            componentCount: this.components.size
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Remove event listeners
        this.elements.navTabs?.forEach(tab => {
            tab.removeEventListener('click', this.boundHandlers.handleTabClick);
        });
        
        this.elements.sidebarToggle?.removeEventListener('click', this.boundHandlers.handleSidebarToggle);
        this.elements.settingsBtn?.removeEventListener('click', this.boundHandlers.handleSettingsClick);
        
        this.elements.mapControls?.forEach(control => {
            control.removeEventListener('click', this.boundHandlers.handleMapControlClick);
        });
        
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        
        // Clear component references
        this.components.clear();
        
        // Clear DOM references
        this.elements = {};
        
        console.log('🎛️ Dashboard component destroyed');
    }
}