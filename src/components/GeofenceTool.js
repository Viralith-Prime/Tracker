/**
 * Geofence Tool Component
 * 
 * Provides geofencing capabilities using Turf.js for spatial calculations.
 * Allows users to create, edit, and manage geographical boundaries for monitoring.
 */

import { DOMOptimizer } from '../utils/performance.js';

/**
 * GeofenceTool component class
 * Manages geofencing functionality and spatial monitoring
 */
export class GeofenceTool {
    constructor(options = {}) {
        this.store = options.store;
        this.map = options.map;
        this.container = null;
        this.isInitialized = false;
        
        // Geofencing state
        this.geofences = new Map();
        this.activeGeofences = new Map();
        this.drawMode = false;
        this.draw = null; // MapboxDraw instance
        
        // Event tracking for aircraft
        this.aircraftStates = new Map(); // Track which aircraft are inside which geofences
        
        console.log('🗺️ GeofenceTool component initialized');
    }

    /**
     * Initialize the component
     */
    async initialize() {
        try {
            // Find the container
            this.container = document.querySelector('#geofences-container');
            if (!this.container) {
                throw new Error('Geofences container not found');
            }
            
            // Initialize MapboxDraw if map is available
            if (this.map && window.MapboxDraw) {
                this.initializeDrawControls();
            }
            
            // Subscribe to store changes
            this.subscribeToStore();
            
            // Initial render
            await this.render();
            
            this.isInitialized = true;
            console.log('✅ GeofenceTool initialized successfully');
            
        } catch (error) {
            console.error('❌ GeofenceTool initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize MapboxDraw controls
     */
    initializeDrawControls() {
        if (!this.map) return;
        
        this.draw = new MapboxDraw({
            displayControlsDefault: false,
            controls: {
                polygon: true,
                trash: true
            },
            styles: [
                // Polygon fill
                {
                    'id': 'gl-draw-polygon-fill-inactive',
                    'type': 'fill',
                    'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    'paint': {
                        'fill-color': '#3b82f6',
                        'fill-outline-color': '#3b82f6',
                        'fill-opacity': 0.1
                    }
                },
                // Polygon stroke
                {
                    'id': 'gl-draw-polygon-stroke-inactive',
                    'type': 'line',
                    'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
                    'layout': {
                        'line-cap': 'round',
                        'line-join': 'round'
                    },
                    'paint': {
                        'line-color': '#3b82f6',
                        'line-width': 2,
                        'line-dasharray': [2, 2]
                    }
                }
            ]
        });
        
        const mapInstance = this.map.getMapInstance();
        if (mapInstance) {
            mapInstance.addControl(this.draw, 'top-right');
            
            // Bind drawing events
            mapInstance.on('draw.create', this.handleGeofenceCreated.bind(this));
            mapInstance.on('draw.update', this.handleGeofenceUpdated.bind(this));
            mapInstance.on('draw.delete', this.handleGeofenceDeleted.bind(this));
        }
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        if (!this.store) return;
        
        // Subscribe to geofence data
        this.store.subscribe('user.geofences', (path, geofences) => {
            this.updateGeofences(geofences);
        });
        
        // Subscribe to aircraft data for geofence checking
        this.store.subscribe('live.aircraft', (path, aircraftMap) => {
            this.checkAircraftGeofences(aircraftMap);
        });
        
        // Subscribe to UI geofence mode
        this.store.subscribe('ui.geofenceMode', (path, isActive) => {
            this.toggleDrawMode(isActive);
        });
    }

    /**
     * Render the geofence list
     */
    async render() {
        const geofences = this.store?.getState().user.geofences || [];
        
        if (geofences.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        await this.renderGeofenceList(geofences);
    }

    /**
     * Render empty geofence state
     */
    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📍</div>
                <h4>No Geofences Created</h4>
                <p>Create geographical boundaries to monitor aircraft activity in specific areas.</p>
                <div class="empty-actions">
                    <button class="btn btn-primary" id="create-geofence">
                        <i class="icon-plus"></i>
                        Create Geofence
                    </button>
                </div>
            </div>
        `;
        
        // Bind create button
        const createBtn = this.container.querySelector('#create-geofence');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.startDrawMode());
        }
    }

    /**
     * Render geofence list
     */
    async renderGeofenceList(geofences) {
        const template = document.getElementById('geofence-item-template');
        if (!template) {
            console.error('Geofence item template not found');
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        for (const geofence of geofences) {
            const item = this.createGeofenceItem(template, geofence);
            fragment.appendChild(item);
        }
        
        // Add create button at the top
        const createButton = document.createElement('div');
        createButton.className = 'geofence-create-btn';
        createButton.innerHTML = `
            <button class="btn btn-outline btn-block" id="create-geofence">
                <i class="icon-plus"></i>
                Create New Geofence
            </button>
        `;
        fragment.insertBefore(createButton, fragment.firstChild);
        
        await DOMOptimizer.replaceContent(this.container, fragment);
        
        // Bind create button
        const createBtn = this.container.querySelector('#create-geofence');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.startDrawMode());
        }
    }

    /**
     * Create a geofence item element
     */
    createGeofenceItem(template, geofence) {
        const item = template.content.cloneNode(true);
        const container = item.querySelector('.geofence-item');
        
        if (!container) return item;
        
        // Set data attributes
        container.dataset.id = geofence.id;
        
        // Name
        const name = item.querySelector('.geofence-name');
        if (name) {
            name.textContent = geofence.name || `Geofence ${geofence.id}`;
        }
        
        // Status
        const status = item.querySelector('.geofence-status');
        if (status) {
            status.textContent = geofence.active !== false ? 'Active' : 'Disabled';
            status.className = `geofence-status ${geofence.active !== false ? 'active' : 'disabled'}`;
        }
        
        // Area calculation
        if (geofence.geojson && window.turf) {
            const area = turf.area(geofence.geojson);
            const areaKm2 = (area / 1000000).toFixed(2);
            const areaElement = item.querySelector('.geofence-area');
            if (areaElement) {
                areaElement.textContent = `${areaKm2} km²`;
            }
        }
        
        // Aircraft count (current)
        const aircraftCount = this.getAircraftInGeofence(geofence.id);
        const countElement = item.querySelector('.aircraft-count');
        if (countElement) {
            countElement.textContent = aircraftCount.toString();
        }
        
        // Toggle switch
        const toggle = item.querySelector('.geofence-toggle');
        if (toggle) {
            toggle.checked = geofence.active !== false;
            toggle.addEventListener('change', () => {
                this.toggleGeofence(geofence.id, toggle.checked);
            });
        }
        
        // Bind event listeners
        this.bindGeofenceItemEvents(container, geofence);
        
        return item;
    }

    /**
     * Bind event listeners to geofence item
     */
    bindGeofenceItemEvents(container, geofence) {
        // Focus on geofence
        const focusBtn = container.querySelector('.focus-btn');
        if (focusBtn) {
            focusBtn.addEventListener('click', () => {
                this.focusOnGeofence(geofence);
            });
        }
        
        // Edit geofence
        const editBtn = container.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editGeofence(geofence);
            });
        }
        
        // Delete geofence
        const deleteBtn = container.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteGeofence(geofence.id);
            });
        }
    }

    /**
     * Handle geofence creation from drawing
     */
    handleGeofenceCreated(event) {
        const feature = event.features[0];
        if (!feature || feature.geometry.type !== 'Polygon') return;
        
        const geofence = {
            id: this.generateGeofenceId(),
            name: `Geofence ${Date.now()}`,
            geojson: feature.geometry,
            active: true,
            created: new Date().toISOString(),
            alerts: {
                onEnter: true,
                onExit: true
            }
        };
        
        this.addGeofence(geofence);
        
        // Clear the draw tool
        this.draw.deleteAll();
        this.stopDrawMode();
    }

    /**
     * Handle geofence updates
     */
    handleGeofenceUpdated(event) {
        // TODO: Implement geofence editing
        console.log('Geofence updated:', event.features);
    }

    /**
     * Handle geofence deletion from drawing
     */
    handleGeofenceDeleted(event) {
        // TODO: Implement geofence deletion through drawing
        console.log('Geofence deleted:', event.features);
    }

    /**
     * Check aircraft against all active geofences
     */
    checkAircraftGeofences(aircraftMap) {
        if (!aircraftMap || !window.turf) return;
        
        const geofences = this.store?.getState().user.geofences || [];
        const activeGeofences = geofences.filter(gf => gf.active !== false);
        
        for (const [hex, aircraft] of aircraftMap.entries()) {
            if (!aircraft.lat || !aircraft.lon) continue;
            
            const aircraftPoint = turf.point([aircraft.lon, aircraft.lat]);
            
            for (const geofence of activeGeofences) {
                if (!geofence.geojson) continue;
                
                const isInside = turf.booleanPointInPolygon(aircraftPoint, geofence.geojson);
                const wasInside = this.aircraftStates.get(`${hex}-${geofence.id}`) || false;
                
                if (isInside && !wasInside) {
                    // Aircraft entered geofence
                    this.handleGeofenceEvent('enter', aircraft, geofence);
                } else if (!isInside && wasInside) {
                    // Aircraft exited geofence
                    this.handleGeofenceEvent('exit', aircraft, geofence);
                }
                
                // Update state
                this.aircraftStates.set(`${hex}-${geofence.id}`, isInside);
            }
        }
    }

    /**
     * Handle geofence entry/exit events
     */
    handleGeofenceEvent(eventType, aircraft, geofence) {
        const event = {
            type: eventType,
            aircraft: {
                hex: aircraft.hex,
                callsign: aircraft.flight || aircraft.hex,
                military: aircraft.military || false,
                emergency: aircraft.emergency || false
            },
            geofence: {
                id: geofence.id,
                name: geofence.name
            },
            timestamp: new Date().toISOString(),
            location: {
                lat: aircraft.lat,
                lon: aircraft.lon,
                altitude: aircraft.altitude
            }
        };
        
        console.log(`🚨 Geofence ${eventType}:`, event);
        
        // Trigger alert if enabled
        if ((eventType === 'enter' && geofence.alerts?.onEnter) ||
            (eventType === 'exit' && geofence.alerts?.onExit)) {
            this.triggerGeofenceAlert(event);
        }
        
        // Store event for history
        this.storeGeofenceEvent(event);
    }

    /**
     * Trigger geofence alert
     */
    triggerGeofenceAlert(event) {
        // Create alert for the alert system
        const alert = {
            id: `geofence-${Date.now()}`,
            type: 'geofence',
            severity: event.aircraft.emergency ? 'critical' : 
                     event.aircraft.military ? 'high' : 'medium',
            title: `Aircraft ${event.type === 'enter' ? 'Entered' : 'Exited'} Geofence`,
            message: `${event.aircraft.callsign} ${event.type === 'enter' ? 'entered' : 'exited'} ${event.geofence.name}`,
            timestamp: event.timestamp,
            data: event
        };
        
        // Add to alerts (assuming we have an alert system)
        console.log('Geofence alert:', alert);
        
        // TODO: Integrate with AlertSystem component
    }

    /**
     * Store geofence event for history
     */
    storeGeofenceEvent(event) {
        // TODO: Store in IndexedDB for history tracking
        console.log('Storing geofence event:', event);
    }

    /**
     * Add new geofence
     */
    addGeofence(geofence) {
        if (!this.store) return;
        
        const currentGeofences = this.store.getState().user.geofences || [];
        const newGeofences = [...currentGeofences, geofence];
        
        this.store.setState('user.geofences', newGeofences);
        this.store.persistState(['user']);
    }

    /**
     * Toggle geofence active state
     */
    toggleGeofence(id, active) {
        if (!this.store) return;
        
        const currentGeofences = this.store.getState().user.geofences || [];
        const updatedGeofences = currentGeofences.map(gf => 
            gf.id === id ? { ...gf, active } : gf
        );
        
        this.store.setState('user.geofences', updatedGeofences);
        this.store.persistState(['user']);
    }

    /**
     * Delete geofence
     */
    deleteGeofence(id) {
        if (!this.store) return;
        
        if (!confirm('Are you sure you want to delete this geofence?')) return;
        
        const currentGeofences = this.store.getState().user.geofences || [];
        const updatedGeofences = currentGeofences.filter(gf => gf.id !== id);
        
        this.store.setState('user.geofences', updatedGeofences);
        this.store.persistState(['user']);
        
        // Clear aircraft states for this geofence
        for (const key of this.aircraftStates.keys()) {
            if (key.endsWith(`-${id}`)) {
                this.aircraftStates.delete(key);
            }
        }
    }

    /**
     * Focus map on geofence
     */
    focusOnGeofence(geofence) {
        if (!this.map || !geofence.geojson || !window.turf) return;
        
        try {
            const bbox = turf.bbox(geofence.geojson);
            const mapInstance = this.map.getMapInstance();
            
            if (mapInstance) {
                mapInstance.fitBounds(bbox, {
                    padding: 50,
                    duration: 1000
                });
            }
        } catch (error) {
            console.error('Error focusing on geofence:', error);
        }
    }

    /**
     * Edit geofence (placeholder)
     */
    editGeofence(geofence) {
        // TODO: Implement geofence editing
        console.log('Edit geofence:', geofence);
    }

    /**
     * Start drawing mode
     */
    startDrawMode() {
        this.drawMode = true;
        
        if (this.store) {
            this.store.setState('ui.geofenceMode', true);
        }
        
        // Change cursor and provide visual feedback
        const mapInstance = this.map?.getMapInstance();
        if (mapInstance) {
            mapInstance.getCanvas().style.cursor = 'crosshair';
        }
    }

    /**
     * Stop drawing mode
     */
    stopDrawMode() {
        this.drawMode = false;
        
        if (this.store) {
            this.store.setState('ui.geofenceMode', false);
        }
        
        // Reset cursor
        const mapInstance = this.map?.getMapInstance();
        if (mapInstance) {
            mapInstance.getCanvas().style.cursor = '';
        }
    }

    /**
     * Toggle drawing mode
     */
    toggleDrawMode(isActive) {
        if (isActive) {
            this.startDrawMode();
        } else {
            this.stopDrawMode();
        }
    }

    /**
     * Get count of aircraft currently in geofence
     */
    getAircraftInGeofence(geofenceId) {
        let count = 0;
        
        for (const [key, isInside] of this.aircraftStates.entries()) {
            if (key.endsWith(`-${geofenceId}`) && isInside) {
                count++;
            }
        }
        
        return count;
    }

    /**
     * Generate unique geofence ID
     */
    generateGeofenceId() {
        return `gf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update geofences from store
     */
    updateGeofences(geofences) {
        // Update internal state
        this.geofences.clear();
        this.activeGeofences.clear();
        
        for (const geofence of geofences) {
            this.geofences.set(geofence.id, geofence);
            if (geofence.active !== false) {
                this.activeGeofences.set(geofence.id, geofence);
            }
        }
        
        // Re-render
        this.render();
    }

    /**
     * Export geofences
     */
    exportGeofences() {
        const geofences = this.store?.getState().user.geofences || [];
        
        return {
            geofences,
            events: [], // TODO: Include event history
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Import geofences
     */
    importGeofences(data) {
        if (!data || !Array.isArray(data.geofences)) {
            throw new Error('Invalid geofence data format');
        }
        
        if (this.store) {
            this.store.setState('user.geofences', data.geofences);
            this.store.persistState(['user']);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopDrawMode();
        
        // Remove draw control
        if (this.draw && this.map) {
            const mapInstance = this.map.getMapInstance();
            if (mapInstance) {
                mapInstance.removeControl(this.draw);
            }
        }
        
        this.geofences.clear();
        this.activeGeofences.clear();
        this.aircraftStates.clear();
        this.container = null;
        
        console.log('🗺️ GeofenceTool component destroyed');
    }
}