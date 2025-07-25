/**
 * High-Fidelity OSINT Aircraft Tracking Dashboard
 * Main Application Entry Point
 * 
 * This module serves as the application orchestrator, following the blueprint's
 * specifications for a maintainable vanilla JavaScript SPA architecture.
 */

// Import core modules
import { Store } from './state/store.js';
import { Map } from './components/Map.js';
import { Dashboard } from './components/Dashboard.js';
import { AircraftDetailsPanel } from './components/AircraftDetailsPanel.js';
import { Watchlist } from './components/Watchlist.js';
import { GeofenceTool } from './components/GeofenceTool.js';
import { AlertSystem } from './components/AlertSystem.js';
import { ADSB_API_Service } from './services/ADSB_API_Service.js';
import { AircraftDB_Service } from './services/AircraftDB_Service.js';
import { Router } from './utils/Router.js';
import { debounce, throttle } from './utils/performance.js';

/**
 * Main Application Class
 * Implements the SPA architecture with centralized state management
 */
class OSINTAircraftTracker {
    constructor() {
        this.store = null;
        this.router = null;
        this.components = new Map();
        this.services = new Map();
        
        // Performance monitoring
        this.performanceMetrics = {
            lastFrameTime: 0,
            frameCount: 0,
            averageFPS: 0
        };

        // Application state flags
        this.isInitialized = false;
        this.isDataLoading = false;
        this.lastUpdateTime = null;
        
        // Bound methods for event listeners
        this.handleResize = debounce(this.handleResize.bind(this), 250);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    }

    /**
     * Initialize the application
     * This is the main bootstrap method that sets up all components
     */
    async init() {
        try {
            console.log('🚀 Initializing OSINT Aircraft Tracking Dashboard...');
            
            // Initialize core systems
            await this.initializeStore();
            await this.initializeServices();
            await this.initializeRouter();
            await this.initializeComponents();
            
            // Set up global event listeners
            this.bindGlobalEvents();
            
            // Start the application
            await this.startApplication();
            
            this.isInitialized = true;
            console.log('✅ Application initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    /**
     * Initialize the central state store with Proxy-based reactivity
     */
    async initializeStore() {
        console.log('📦 Initializing state store...');
        
        this.store = new Store({
            // Live data - updated frequently
            live: {
                aircraft: new Map(),
                lastUpdateTimestamp: null,
                connectionStatus: 'connecting',
                dataSource: 'adsb.fi'
            },
            
            // UI state - user interactions
            ui: {
                selectedAircraftHex: null,
                map: {
                    center: [-98.5795, 39.8283], // Continental US
                    zoom: 4,
                    style: 'dark'
                },
                isDetailsPanelOpen: false,
                sidebarCollapsed: false,
                activeTab: 'watchlist',
                showLabels: true,
                showTrails: false,
                geofenceMode: false
            },
            
            // User data - persisted across sessions
            user: {
                watchlist: [],
                geofences: [],
                settings: {
                    theme: 'dark',
                    units: 'imperial',
                    updateInterval: 5000, // 5 seconds
                    enableNotifications: true,
                    enableSounds: true,
                    dataSource: 'adsb.fi'
                },
                preferences: {
                    mapStyle: 'satellite',
                    iconSize: 'medium',
                    trailLength: 50
                }
            },
            
            // Application metadata
            app: {
                version: '1.0.0',
                lastStartTime: Date.now(),
                performanceMetrics: {},
                errors: []
            }
        });

        // Subscribe to state changes for debugging in development
        if (process.env.NODE_ENV === 'development') {
            this.store.subscribe('*', (path, newValue, oldValue) => {
                console.log(`State changed: ${path}`, { newValue, oldValue });
            });
        }
    }

    /**
     * Initialize data services
     */
    async initializeServices() {
        console.log('🛰️ Initializing data services...');
        
        // Initialize aircraft database service
        const aircraftDB = new AircraftDB_Service();
        await aircraftDB.initialize();
        this.services.set('aircraftDB', aircraftDB);
        
        // Initialize ADS-B API service
        const adsbAPI = new ADSB_API_Service({
            primarySource: this.store.getState().user.settings.dataSource,
            updateInterval: this.store.getState().user.settings.updateInterval,
            onDataReceived: this.handleAircraftDataReceived.bind(this),
            onError: this.handleDataServiceError.bind(this),
            onStatusChange: this.handleConnectionStatusChange.bind(this)
        });
        this.services.set('adsbAPI', adsbAPI);
    }

    /**
     * Initialize client-side router
     */
    async initializeRouter() {
        console.log('🗺️ Initializing router...');
        
        this.router = new Router({
            '/': () => this.showDashboard(),
            '/aircraft/:hex': (params) => this.showAircraftDetails(params.hex),
            '/settings': () => this.showSettings(),
            '/about': () => this.showAbout()
        });
        
        this.router.start();
    }

    /**
     * Initialize UI components
     */
    async initializeComponents() {
        console.log('🎛️ Initializing UI components...');
        
        // Initialize main dashboard
        const dashboard = new Dashboard({
            container: document.getElementById('app'),
            store: this.store
        });
        await dashboard.initialize();
        this.components.set('dashboard', dashboard);
        
        // Initialize map component
        const map = new Map({
            container: 'map',
            store: this.store,
            onAircraftClick: this.handleAircraftClick.bind(this),
            onMapMove: throttle(this.handleMapMove.bind(this), 100)
        });
        await map.initialize();
        this.components.set('map', map);
        
        // Initialize aircraft details panel
        const detailsPanel = new AircraftDetailsPanel({
            store: this.store,
            aircraftDB: this.services.get('aircraftDB')
        });
        await detailsPanel.initialize();
        this.components.set('detailsPanel', detailsPanel);
        
        // Initialize watchlist component
        const watchlist = new Watchlist({
            store: this.store,
            onAircraftSelect: this.handleWatchlistAircraftSelect.bind(this)
        });
        await watchlist.initialize();
        this.components.set('watchlist', watchlist);
        
        // Initialize geofence tool
        const geofenceTool = new GeofenceTool({
            map: map.getMapInstance(),
            store: this.store,
            onGeofenceEvent: this.handleGeofenceEvent.bind(this)
        });
        await geofenceTool.initialize();
        this.components.set('geofenceTool', geofenceTool);
        
        // Initialize alert system
        const alertSystem = new AlertSystem({
            store: this.store,
            notificationPermission: this.store.getState().user.settings.enableNotifications
        });
        await alertSystem.initialize();
        this.components.set('alertSystem', alertSystem);
    }

    /**
     * Bind global event listeners
     */
    bindGlobalEvents() {
        console.log('🎧 Binding global event listeners...');
        
        // Window events
        window.addEventListener('resize', this.handleResize);
        window.addEventListener('beforeunload', this.handleBeforeUnload);
        
        // Visibility API for performance optimization
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        
        // Online/offline status
        window.addEventListener('online', () => this.handleConnectionChange(true));
        window.addEventListener('offline', () => this.handleConnectionChange(false));
    }

    /**
     * Start the main application loop
     */
    async startApplication() {
        console.log('▶️ Starting application...');
        
        // Start data fetching
        await this.services.get('adsbAPI').start();
        
        // Start performance monitoring
        this.startPerformanceMonitoring();
        
        // Update connection status
        this.store.setState('live.connectionStatus', 'connected');
        
        // Show initial view
        this.router.navigate('/');
    }

    /**
     * Handle incoming aircraft data
     */
    async handleAircraftDataReceived(aircraftData) {
        try {
            const aircraftDB = this.services.get('aircraftDB');
            const enrichedAircraft = new Map();
            
            // Process and enrich each aircraft
            for (const aircraft of aircraftData) {
                if (aircraft.hex && aircraft.lat && aircraft.lon) {
                    const enriched = await aircraftDB.enrichAircraft(aircraft);
                    enrichedAircraft.set(aircraft.hex, enriched);
                }
            }
            
            // Update state with new aircraft data
            this.store.setState('live.aircraft', enrichedAircraft);
            this.store.setState('live.lastUpdateTimestamp', Date.now());
            
            // Trigger geofence checks
            this.components.get('geofenceTool')?.checkGeofences(enrichedAircraft);
            
            // Update performance metrics
            this.updatePerformanceMetrics();
            
        } catch (error) {
            console.error('Error processing aircraft data:', error);
            this.store.setState('app.errors', [...this.store.getState().app.errors, {
                timestamp: Date.now(),
                type: 'data_processing',
                message: error.message
            }]);
        }
    }

    /**
     * Handle aircraft click events
     */
    handleAircraftClick(aircraftHex) {
        this.store.setState('ui.selectedAircraftHex', aircraftHex);
        this.store.setState('ui.isDetailsPanelOpen', true);
        this.router.navigate(`/aircraft/${aircraftHex}`);
    }

    /**
     * Handle watchlist aircraft selection
     */
    handleWatchlistAircraftSelect(aircraftHex) {
        const map = this.components.get('map');
        const aircraft = this.store.getState().live.aircraft.get(aircraftHex);
        
        if (aircraft && map) {
            map.flyToAircraft(aircraft);
            this.handleAircraftClick(aircraftHex);
        }
    }

    /**
     * Handle geofence events (enter/exit)
     */
    handleGeofenceEvent(event) {
        const alertSystem = this.components.get('alertSystem');
        
        if (alertSystem) {
            alertSystem.triggerAlert({
                type: 'geofence',
                severity: 'medium',
                title: `Geofence ${event.type}`,
                message: `Aircraft ${event.aircraft.callsign || event.aircraft.hex} has ${event.type}ed geofence "${event.geofence.name}"`,
                aircraft: event.aircraft,
                geofence: event.geofence
            });
        }
    }

    /**
     * Handle connection status changes
     */
    handleConnectionStatusChange(status) {
        this.store.setState('live.connectionStatus', status);
        
        const alertSystem = this.components.get('alertSystem');
        if (alertSystem && status === 'error') {
            alertSystem.triggerAlert({
                type: 'connection',
                severity: 'high',
                title: 'Connection Lost',
                message: 'Lost connection to data source. Attempting to reconnect...'
            });
        }
    }

    /**
     * Handle data service errors
     */
    handleDataServiceError(error) {
        console.error('Data service error:', error);
        this.store.setState('live.connectionStatus', 'error');
        
        // Log error for debugging
        this.store.setState('app.errors', [...this.store.getState().app.errors, {
            timestamp: Date.now(),
            type: 'service_error',
            message: error.message,
            source: 'ADSB_API_Service'
        }]);
    }

    /**
     * Handle map movement for performance optimization
     */
    handleMapMove(event) {
        // Update map state
        this.store.setState('ui.map.center', [event.center.lng, event.center.lat]);
        this.store.setState('ui.map.zoom', event.zoom);
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Notify components of resize
        this.components.forEach(component => {
            if (component.handleResize) {
                component.handleResize();
            }
        });
    }

    /**
     * Handle visibility change for performance optimization
     */
    handleVisibilityChange() {
        const isHidden = document.hidden;
        
        // Reduce update frequency when tab is hidden
        const adsbAPI = this.services.get('adsbAPI');
        if (adsbAPI) {
            if (isHidden) {
                adsbAPI.setUpdateInterval(30000); // 30 seconds when hidden
            } else {
                adsbAPI.setUpdateInterval(this.store.getState().user.settings.updateInterval);
            }
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + K: Focus search
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            // Focus search functionality
        }
        
        // Escape: Close panels
        if (event.key === 'Escape') {
            this.store.setState('ui.isDetailsPanelOpen', false);
            this.store.setState('ui.selectedAircraftHex', null);
        }
        
        // Space: Toggle geofence mode
        if (event.key === ' ' && !event.target.matches('input, textarea')) {
            event.preventDefault();
            const currentMode = this.store.getState().ui.geofenceMode;
            this.store.setState('ui.geofenceMode', !currentMode);
        }
    }

    /**
     * Handle online/offline status changes
     */
    handleConnectionChange(isOnline) {
        if (isOnline) {
            // Resume normal operation
            this.services.get('adsbAPI')?.start();
            this.store.setState('live.connectionStatus', 'connected');
        } else {
            // Handle offline mode
            this.store.setState('live.connectionStatus', 'offline');
            
            const alertSystem = this.components.get('alertSystem');
            if (alertSystem) {
                alertSystem.triggerAlert({
                    type: 'connection',
                    severity: 'high',
                    title: 'Offline',
                    message: 'No internet connection. Data updates paused.'
                });
            }
        }
    }

    /**
     * Handle application cleanup before unload
     */
    handleBeforeUnload() {
        // Save current state to IndexedDB
        const currentState = this.store.getState();
        
        // Persist user data
        const userData = {
            watchlist: currentState.user.watchlist,
            geofences: currentState.user.geofences,
            settings: currentState.user.settings,
            preferences: currentState.user.preferences
        };
        
        // Use localStorage as fallback for critical data
        localStorage.setItem('osint-tracker-user-data', JSON.stringify(userData));
        
        // Stop services
        this.services.get('adsbAPI')?.stop();
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        const monitor = () => {
            const now = performance.now();
            const deltaTime = now - this.performanceMetrics.lastFrameTime;
            
            if (deltaTime >= 1000) { // Update every second
                this.performanceMetrics.averageFPS = Math.round(this.performanceMetrics.frameCount / (deltaTime / 1000));
                this.performanceMetrics.frameCount = 0;
                this.performanceMetrics.lastFrameTime = now;
                
                // Update store with performance metrics
                this.store.setState('app.performanceMetrics', {
                    fps: this.performanceMetrics.averageFPS,
                    aircraftCount: this.store.getState().live.aircraft.size,
                    memoryUsage: performance.memory ? {
                        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
                    } : null
                });
            }
            
            this.performanceMetrics.frameCount++;
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const state = this.store.getState();
        const aircraftCount = state.live.aircraft.size;
        
        // Update last update time
        this.lastUpdateTime = Date.now();
        
        // Calculate data processing metrics
        const processingTime = performance.now();
        // ... processing metrics logic
    }

    /**
     * Handle initialization errors
     */
    handleInitializationError(error) {
        // Show error message to user
        const errorContainer = document.getElementById('app');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-screen">
                    <div class="error-content">
                        <h1>⚠️ Initialization Error</h1>
                        <p>Failed to initialize the OSINT Aircraft Tracking Dashboard.</p>
                        <details>
                            <summary>Error Details</summary>
                            <pre>${error.message}\n${error.stack}</pre>
                        </details>
                        <button onclick="location.reload()" class="btn btn-primary">
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Router handlers
     */
    showDashboard() {
        this.components.get('dashboard')?.show();
    }

    showAircraftDetails(hex) {
        this.store.setState('ui.selectedAircraftHex', hex);
        this.store.setState('ui.isDetailsPanelOpen', true);
    }

    showSettings() {
        // Implementation for settings view
        console.log('Show settings');
    }

    showAbout() {
        // Implementation for about view
        console.log('Show about');
    }
}

/**
 * Application entry point
 * Initialize and start the application when DOM is ready
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Create global app instance
    window.OSINTTracker = new OSINTAircraftTracker();
    
    // Initialize application
    await window.OSINTTracker.init();
});

// Export for module usage
export { OSINTAircraftTracker };