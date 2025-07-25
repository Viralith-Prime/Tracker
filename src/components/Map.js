/**
 * Map Component
 * 
 * High-performance MapLibre GL JS wrapper with aircraft rendering,
 * linear interpolation for smooth movement, and geofencing capabilities.
 */

import { rafThrottle } from '../utils/performance.js';

/**
 * Map component class
 * Handles all map-related functionality including aircraft visualization
 */
export class Map {
    constructor(options = {}) {
        this.config = {
            container: options.container || 'map',
            style: 'https://demotiles.maplibre.org/style.json',
            center: options.center || [-98.5795, 39.8283], // Continental US
            zoom: options.zoom || 4,
            maxZoom: 18,
            minZoom: 2,
            ...options
        };

        this.store = options.store;
        this.map = null;
        this.isInitialized = false;
        
        // Aircraft data management
        this.aircraftData = new Map();
        this.aircraftPositions = new Map(); // For interpolation
        this.interpolationTargets = new Map();
        
        // Animation system
        this.animationId = null;
        this.lastFrameTime = 0;
        this.isAnimating = false;
        
        // Event callbacks
        this.onAircraftClick = options.onAircraftClick || (() => {});
        this.onMapMove = options.onMapMove || (() => {});
        
        // Layer management
        this.layers = {
            aircraft: 'aircraft-layer',
            aircraftLabels: 'aircraft-labels-layer',
            trails: 'aircraft-trails-layer',
            geofences: 'geofences-layer'
        };
        
        // Map state
        this.showLabels = true;
        this.showTrails = false;
        
        // Performance monitoring
        this.renderStats = {
            frameCount: 0,
            lastStatsUpdate: 0,
            averageFPS: 0
        };

        console.log('🗺️ Map component initialized');
    }

    /**
     * Initialize the map
     */
    async initialize() {
        try {
            // Create MapLibre map instance
            this.map = new maplibregl.Map({
                container: this.config.container,
                style: this.config.style,
                center: this.config.center,
                zoom: this.config.zoom,
                maxZoom: this.config.maxZoom,
                minZoom: this.config.minZoom,
                antialias: true,
                preserveDrawingBuffer: false,
                failIfMajorPerformanceCaveat: false
            });

            // Wait for map to load
            await new Promise((resolve, reject) => {
                this.map.on('load', resolve);
                this.map.on('error', reject);
            });

            // Initialize map features
            await this.setupLayers();
            this.bindEventListeners();
            this.startAnimation();
            
            // Subscribe to state changes
            this.subscribeToStore();
            
            this.isInitialized = true;
            console.log('✅ Map initialized successfully');
            
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set up map layers for aircraft visualization
     */
    async setupLayers() {
        // Add aircraft icons to map sprite
        await this.loadAircraftIcons();
        
        // Add aircraft data source
        this.map.addSource('aircraft', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            },
            cluster: false,
            buffer: 0,
            maxzoom: 24
        });
        
        // Add aircraft trails source
        this.map.addSource('aircraft-trails', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });
        
        // Add geofences source
        this.map.addSource('geofences', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: []
            }
        });
        
        // Aircraft symbol layer
        this.map.addLayer({
            id: this.layers.aircraft,
            type: 'symbol',
            source: 'aircraft',
            layout: {
                'icon-image': [
                    'case',
                    ['get', 'military'], 'military-aircraft',
                    ['get', 'emergency'], 'emergency-aircraft',
                    'civilian-aircraft'
                ],
                'icon-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    4, 0.3,
                    8, 0.6,
                    12, 1.0,
                    16, 1.5
                ],
                'icon-rotate': ['get', 'track'],
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true
            },
            paint: {
                'icon-opacity': [
                    'case',
                    ['get', 'isWatched'], 1.0,
                    ['>', ['get', 'seen'], 30], 0.5,
                    0.8
                ],
                'icon-color': [
                    'case',
                    ['get', 'emergency'], '#ff0000',
                    ['get', 'military'], '#ff6b35',
                    ['get', 'isWatched'], '#00ff00',
                    '#3b82f6'
                ]
            }
        });
        
        // Aircraft labels layer
        this.map.addLayer({
            id: this.layers.aircraftLabels,
            type: 'symbol',
            source: 'aircraft',
            layout: {
                'text-field': [
                    'case',
                    ['!=', ['get', 'callsign'], ''], ['get', 'callsign'],
                    ['get', 'hex']
                ],
                'text-font': ['Open Sans Regular'],
                'text-size': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 10,
                    12, 12,
                    16, 14
                ],
                'text-offset': [0, 2],
                'text-anchor': 'top',
                'text-allow-overlap': false,
                'text-ignore-placement': false
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#000000',
                'text-halo-width': 1,
                'text-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    8, 0,
                    10, 1
                ]
            }
        });
        
        // Aircraft trails layer
        this.map.addLayer({
            id: this.layers.trails,
            type: 'line',
            source: 'aircraft-trails',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': [
                    'case',
                    ['get', 'military'], '#ff6b35',
                    '#3b82f6'
                ],
                'line-width': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    4, 1,
                    8, 2,
                    12, 3
                ],
                'line-opacity': 0.6
            }
        });
        
        // Geofences layer
        this.map.addLayer({
            id: this.layers.geofences,
            type: 'fill',
            source: 'geofences',
            paint: {
                'fill-color': '#3b82f6',
                'fill-opacity': 0.1
            }
        });
        
        // Geofence borders layer
        this.map.addLayer({
            id: 'geofences-border',
            type: 'line',
            source: 'geofences',
            paint: {
                'line-color': '#3b82f6',
                'line-width': 2,
                'line-dasharray': [2, 2]
            }
        });
        
        console.log('📍 Map layers configured');
    }

    /**
     * Load aircraft icons into the map sprite
     */
    async loadAircraftIcons() {
        const icons = {
            'civilian-aircraft': this.createAircraftIcon('#3b82f6'),
            'military-aircraft': this.createAircraftIcon('#ff6b35'),
            'emergency-aircraft': this.createAircraftIcon('#ff0000')
        };
        
        for (const [name, iconData] of Object.entries(icons)) {
            const image = await this.loadImage(iconData);
            this.map.addImage(name, image);
        }
    }

    /**
     * Create aircraft icon SVG
     */
    createAircraftIcon(color) {
        const svg = `
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.5 9H21L15.5 13.5L17.5 21L12 17L6.5 21L8.5 13.5L3 9H10.5L12 2Z" 
                      fill="${color}" 
                      stroke="white" 
                      stroke-width="1"/>
            </svg>
        `;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    /**
     * Load image from data URL
     */
    loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Aircraft click events
        this.map.on('click', this.layers.aircraft, (e) => {
            if (e.features.length > 0) {
                const aircraft = e.features[0];
                this.onAircraftClick(aircraft.properties.hex);
            }
        });
        
        // Map interaction events
        this.map.on('move', rafThrottle(() => {
            this.onMapMove({
                center: this.map.getCenter(),
                zoom: this.map.getZoom(),
                bounds: this.map.getBounds()
            });
        }));
        
        // Cursor changes
        this.map.on('mouseenter', this.layers.aircraft, () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        
        this.map.on('mouseleave', this.layers.aircraft, () => {
            this.map.getCanvas().style.cursor = '';
        });
        
        // Performance monitoring
        this.map.on('render', () => {
            this.updateRenderStats();
        });
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        if (!this.store) return;
        
        // Subscribe to aircraft data changes
        this.store.subscribe('live.aircraft', (path, newAircraft) => {
            this.updateAircraftData(newAircraft);
        });
        
        // Subscribe to UI state changes
        this.store.subscribe('ui.showLabels', (path, showLabels) => {
            this.toggleLabels(showLabels);
        });
        
        this.store.subscribe('ui.showTrails', (path, showTrails) => {
            this.toggleTrails(showTrails);
        });
        
        // Subscribe to watchlist changes
        this.store.subscribe('user.watchlist', (path, watchlist) => {
            this.updateWatchlistHighlights(watchlist);
        });
        
        // Subscribe to geofence changes
        this.store.subscribe('user.geofences', (path, geofences) => {
            this.updateGeofences(geofences);
        });
    }

    /**
     * Update aircraft data with smooth interpolation
     */
    updateAircraftData(aircraftMap) {
        if (!aircraftMap || !this.isInitialized) return;
        
        const now = Date.now();
        const features = [];
        
        // Convert Map to array and process each aircraft
        for (const [hex, aircraft] of aircraftMap.entries()) {
            if (!aircraft.lat || !aircraft.lon) continue;
            
            // Set up interpolation for smooth movement
            this.setupInterpolation(hex, aircraft, now);
            
            // Create GeoJSON feature
            const feature = {
                type: 'Feature',
                properties: {
                    hex: aircraft.hex,
                    callsign: aircraft.flight || aircraft.hex,
                    altitude: aircraft.altitude,
                    groundSpeed: aircraft.groundSpeed,
                    track: aircraft.track || 0,
                    squawk: aircraft.squawk,
                    military: aircraft.military || false,
                    emergency: aircraft.emergency || false,
                    seen: aircraft.seen || 0,
                    isWatched: this.isWatched(aircraft.hex),
                    timestamp: now
                },
                geometry: {
                    type: 'Point',
                    coordinates: [aircraft.lon, aircraft.lat]
                }
            };
            
            features.push(feature);
        }
        
        // Update aircraft source data
        const geojson = {
            type: 'FeatureCollection',
            features
        };
        
        this.map.getSource('aircraft').setData(geojson);
        this.aircraftData = new Map(aircraftMap);
        
        console.log(`🛩️ Updated ${features.length} aircraft on map`);
    }

    /**
     * Set up linear interpolation for smooth aircraft movement
     */
    setupInterpolation(hex, aircraft, timestamp) {
        const currentPos = this.aircraftPositions.get(hex);
        
        if (currentPos) {
            // Calculate distance and time since last update
            const timeDelta = timestamp - currentPos.timestamp;
            const distance = this.calculateDistance(
                currentPos.lat, currentPos.lon,
                aircraft.lat, aircraft.lon
            );
            
            // Only interpolate if movement is reasonable (not teleporting)
            if (distance < 1000 && timeDelta > 0) { // Less than 1000km
                this.interpolationTargets.set(hex, {
                    startLat: currentPos.lat,
                    startLon: currentPos.lon,
                    targetLat: aircraft.lat,
                    targetLon: aircraft.lon,
                    startTime: currentPos.timestamp,
                    endTime: timestamp,
                    track: aircraft.track
                });
            }
        }
        
        // Update current position
        this.aircraftPositions.set(hex, {
            lat: aircraft.lat,
            lon: aircraft.lon,
            timestamp
        });
    }

    /**
     * Start animation loop for smooth movement
     */
    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        this.lastFrameTime = performance.now();
        
        const animate = (currentTime) => {
            if (!this.isAnimating) return;
            
            this.updateInterpolatedPositions(currentTime);
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
        console.log('🎬 Animation loop started');
    }

    /**
     * Stop animation loop
     */
    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Update interpolated positions for smooth movement
     */
    updateInterpolatedPositions(currentTime) {
        if (this.interpolationTargets.size === 0) return;
        
        const updatedFeatures = [];
        let hasUpdates = false;
        
        for (const [hex, target] of this.interpolationTargets.entries()) {
            const progress = Math.min(1, (currentTime - target.startTime) / (target.endTime - target.startTime));
            
            if (progress >= 1) {
                // Animation complete, remove target
                this.interpolationTargets.delete(hex);
                continue;
            }
            
            // Linear interpolation
            const lat = this.lerp(target.startLat, target.targetLat, progress);
            const lon = this.lerp(target.startLon, target.targetLon, progress);
            
            // Get aircraft data for properties
            const aircraft = this.aircraftData.get(hex);
            if (!aircraft) continue;
            
            const feature = {
                type: 'Feature',
                properties: {
                    hex: aircraft.hex,
                    callsign: aircraft.flight || aircraft.hex,
                    altitude: aircraft.altitude,
                    groundSpeed: aircraft.groundSpeed,
                    track: target.track || 0,
                    squawk: aircraft.squawk,
                    military: aircraft.military || false,
                    emergency: aircraft.emergency || false,
                    seen: aircraft.seen || 0,
                    isWatched: this.isWatched(aircraft.hex),
                    timestamp: currentTime
                },
                geometry: {
                    type: 'Point',
                    coordinates: [lon, lat]
                }
            };
            
            updatedFeatures.push(feature);
            hasUpdates = true;
        }
        
        // Update map if we have interpolated positions
        if (hasUpdates) {
            // Get current data and merge with interpolated positions
            const currentData = this.map.getSource('aircraft')._data;
            const mergedFeatures = currentData.features.map(feature => {
                const interpolated = updatedFeatures.find(f => f.properties.hex === feature.properties.hex);
                return interpolated || feature;
            });
            
            this.map.getSource('aircraft').setData({
                type: 'FeatureCollection',
                features: mergedFeatures
            });
        }
    }

    /**
     * Linear interpolation function
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Check if aircraft is in watchlist
     */
    isWatched(hex) {
        if (!this.store) return false;
        const watchlist = this.store.getState().user.watchlist || [];
        return watchlist.includes(hex);
    }

    /**
     * Toggle aircraft labels visibility
     */
    toggleLabels(show) {
        this.showLabels = show;
        this.map.setLayoutProperty(
            this.layers.aircraftLabels,
            'visibility',
            show ? 'visible' : 'none'
        );
    }

    /**
     * Toggle aircraft trails visibility
     */
    toggleTrails(show) {
        this.showTrails = show;
        this.map.setLayoutProperty(
            this.layers.trails,
            'visibility',
            show ? 'visible' : 'none'
        );
    }

    /**
     * Update watchlist highlights
     */
    updateWatchlistHighlights(watchlist) {
        // Force re-render to update watchlist highlighting
        const currentData = this.map.getSource('aircraft')._data;
        if (currentData && currentData.features) {
            currentData.features.forEach(feature => {
                feature.properties.isWatched = watchlist.includes(feature.properties.hex);
            });
            this.map.getSource('aircraft').setData(currentData);
        }
    }

    /**
     * Update geofences on map
     */
    updateGeofences(geofences) {
        const features = geofences.map(geofence => ({
            type: 'Feature',
            properties: {
                id: geofence.id,
                name: geofence.name,
                active: geofence.active !== false
            },
            geometry: geofence.geojson
        }));
        
        this.map.getSource('geofences').setData({
            type: 'FeatureCollection',
            features
        });
    }

    /**
     * Fly to specific aircraft
     */
    flyToAircraft(aircraft) {
        if (!aircraft.lat || !aircraft.lon) return;
        
        this.map.flyTo({
            center: [aircraft.lon, aircraft.lat],
            zoom: 12,
            duration: 2000,
            essential: true
        });
    }

    /**
     * Fit bounds to show all aircraft
     */
    fitToAircraft() {
        const currentData = this.map.getSource('aircraft')._data;
        if (!currentData || currentData.features.length === 0) return;
        
        const coordinates = currentData.features.map(f => f.geometry.coordinates);
        
        if (coordinates.length === 1) {
            this.map.flyTo({
                center: coordinates[0],
                zoom: 10
            });
            return;
        }
        
        const bounds = coordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
        }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
        
        this.map.fitBounds(bounds, {
            padding: 50,
            maxZoom: 12
        });
    }

    /**
     * Update render statistics
     */
    updateRenderStats() {
        this.renderStats.frameCount++;
        const now = performance.now();
        
        if (now - this.renderStats.lastStatsUpdate >= 1000) {
            this.renderStats.averageFPS = this.renderStats.frameCount;
            this.renderStats.frameCount = 0;
            this.renderStats.lastStatsUpdate = now;
        }
    }

    /**
     * Get map performance statistics
     */
    getPerformanceStats() {
        return {
            fps: this.renderStats.averageFPS,
            aircraftCount: this.aircraftData.size,
            interpolationTargets: this.interpolationTargets.size,
            isAnimating: this.isAnimating
        };
    }

    /**
     * Get map instance for external use
     */
    getMapInstance() {
        return this.map;
    }

    /**
     * Handle resize events
     */
    handleResize() {
        if (this.map) {
            this.map.resize();
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopAnimation();
        
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        
        this.aircraftData.clear();
        this.aircraftPositions.clear();
        this.interpolationTargets.clear();
        
        console.log('🗺️ Map component destroyed');
    }
}