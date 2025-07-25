/**
 * Aircraft Details Panel Component
 * 
 * Displays detailed information about selected aircraft including
 * intelligence assessment, telemetry data, and OSINT enrichment.
 */

import { DOMOptimizer } from '../utils/performance.js';

/**
 * Aircraft Details Panel class
 * Manages the contextual sidebar for aircraft information
 */
export class AircraftDetailsPanel {
    constructor(options = {}) {
        this.store = options.store;
        this.aircraftDB = options.aircraftDB;
        this.container = null;
        this.currentAircraft = null;
        this.isInitialized = false;
        
        // Update interval for live data
        this.updateInterval = null;
        this.updateFrequency = 2000; // 2 seconds
        
        console.log('📊 Aircraft Details Panel initialized');
    }

    /**
     * Initialize the component
     */
    async initialize() {
        try {
            // Find the container
            this.container = document.querySelector('#aircraft-details-content');
            if (!this.container) {
                throw new Error('Aircraft details container not found');
            }
            
            // Subscribe to store changes
            this.subscribeToStore();
            
            this.isInitialized = true;
            console.log('✅ Aircraft Details Panel initialized successfully');
            
        } catch (error) {
            console.error('❌ Aircraft Details Panel initialization failed:', error);
            throw error;
        }
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        if (!this.store) return;
        
        // Subscribe to selected aircraft changes
        this.store.subscribe('ui.selectedAircraftHex', async (path, hex) => {
            if (hex) {
                await this.showAircraftDetails(hex);
                this.startLiveUpdates();
            } else {
                this.hideDetails();
                this.stopLiveUpdates();
            }
        });
        
        // Subscribe to details panel visibility
        this.store.subscribe('ui.isDetailsPanelOpen', (path, isOpen) => {
            if (!isOpen) {
                this.stopLiveUpdates();
            }
        });
        
        // Subscribe to watchlist changes to update button states
        this.store.subscribe('user.watchlist', (path, watchlist) => {
            this.updateWatchlistButton(watchlist);
        });
    }

    /**
     * Show aircraft details
     */
    async showAircraftDetails(hex) {
        if (!hex) return;
        
        try {
            // Get aircraft data from store
            const aircraftMap = this.store.getState().live.aircraft;
            let aircraft = aircraftMap ? aircraftMap.get(hex) : null;
            
            if (!aircraft) {
                this.showError('Aircraft not found');
                return;
            }
            
            // Enrich aircraft data if service is available
            if (this.aircraftDB) {
                aircraft = await this.aircraftDB.enrichAircraft(aircraft);
            }
            
            this.currentAircraft = aircraft;
            await this.renderAircraftDetails(aircraft);
            
        } catch (error) {
            console.error('Error showing aircraft details:', error);
            this.showError('Failed to load aircraft details');
        }
    }

    /**
     * Render aircraft details using template
     */
    async renderAircraftDetails(aircraft) {
        const template = document.getElementById('aircraft-details-template');
        if (!template) {
            console.error('Aircraft details template not found');
            return;
        }
        
        // Clone template
        const content = template.content.cloneNode(true);
        
        // Populate basic information
        this.populateBasicInfo(content, aircraft);
        
        // Populate telemetry data
        this.populateTelemetry(content, aircraft);
        
        // Populate intelligence assessment
        this.populateIntelligence(content, aircraft);
        
        // Set up event listeners
        this.bindDetailEventListeners(content, aircraft);
        
        // Replace container content
        await DOMOptimizer.replaceContent(this.container, content);
    }

    /**
     * Populate basic aircraft information
     */
    populateBasicInfo(content, aircraft) {
        // Aircraft icon
        const iconElement = content.querySelector('.aircraft-type-icon');
        if (iconElement && aircraft.icon) {
            iconElement.src = this.getAircraftIcon(aircraft.category, aircraft.military);
            iconElement.alt = aircraft.name || aircraft.icaoType || 'Aircraft';
        }
        
        // Callsign/Flight ID
        const callsignElement = content.querySelector('.aircraft-callsign');
        if (callsignElement) {
            callsignElement.textContent = aircraft.flight || aircraft.hex || 'Unknown';
        }
        
        // Aircraft type/name
        const typeElement = content.querySelector('.aircraft-type');
        if (typeElement) {
            typeElement.textContent = aircraft.name || aircraft.icaoType || 'Unknown Type';
        }
        
        // Registration
        const registrationElement = content.querySelector('.aircraft-registration');
        if (registrationElement) {
            registrationElement.textContent = aircraft.registration || 'N/A';
        }
        
        // Watchlist button state
        const watchlistBtn = content.querySelector('.watchlist-toggle');
        if (watchlistBtn) {
            const watchlist = this.store.getState().user.watchlist || [];
            const isWatched = watchlist.includes(aircraft.hex);
            watchlistBtn.dataset.action = isWatched ? 'remove' : 'add';
            
            const icon = watchlistBtn.querySelector('i');
            if (icon) {
                icon.className = isWatched ? 'icon-bookmark-filled' : 'icon-bookmark';
            }
        }
    }

    /**
     * Populate telemetry data
     */
    populateTelemetry(content, aircraft) {
        // Altitude
        const altitudeElement = content.querySelector('.telemetry-item .altitude');
        if (altitudeElement) {
            altitudeElement.textContent = aircraft.altitude ? 
                `${aircraft.altitude.toLocaleString()}ft` : 'N/A';
        }
        
        // Ground speed
        const speedElement = content.querySelector('.telemetry-item .speed');
        if (speedElement) {
            speedElement.textContent = aircraft.groundSpeed ? 
                `${aircraft.groundSpeed}kts` : 'N/A';
        }
        
        // Heading/Track
        const headingElement = content.querySelector('.telemetry-item .heading');
        if (headingElement) {
            headingElement.textContent = aircraft.track !== null ? 
                `${aircraft.track}°` : 'N/A';
        }
        
        // Squawk code
        const squawkElement = content.querySelector('.telemetry-item .squawk');
        if (squawkElement) {
            squawkElement.textContent = aircraft.squawk || 'N/A';
            
            // Highlight emergency squawks
            if (aircraft.emergency) {
                squawkElement.style.color = '#ff0000';
                squawkElement.style.fontWeight = 'bold';
            }
        }
    }

    /**
     * Populate intelligence assessment
     */
    populateIntelligence(content, aircraft) {
        const intelligence = aircraft.intelligence || {};
        
        // Significance rating
        const significanceElement = content.querySelector('.significance-rating');
        if (significanceElement) {
            const rating = intelligence.significance || 1;
            significanceElement.textContent = this.formatSignificanceRating(rating);
            significanceElement.className = `significance-rating level-${rating}`;
        }
        
        // Mission type
        const missionElement = content.querySelector('.mission-type');
        if (missionElement) {
            missionElement.textContent = this.formatMissionType(intelligence.missionType || 'unknown');
        }
        
        // Operator
        const operatorElement = content.querySelector('.operator');
        if (operatorElement) {
            operatorElement.textContent = aircraft.operator || 'Unknown';
        }
        
        // Add intelligence notes if available
        if (intelligence.notes && intelligence.notes.length > 0) {
            this.addIntelligenceNotes(content, intelligence.notes);
        }
    }

    /**
     * Add intelligence notes to the panel
     */
    addIntelligenceNotes(content, notes) {
        const intelligenceContent = content.querySelector('.intelligence-content');
        if (!intelligenceContent) return;
        
        const notesContainer = document.createElement('div');
        notesContainer.className = 'intelligence-notes';
        
        const notesHeader = document.createElement('h6');
        notesHeader.textContent = 'Intelligence Notes';
        notesContainer.appendChild(notesHeader);
        
        const notesList = document.createElement('ul');
        notes.forEach(note => {
            const listItem = document.createElement('li');
            listItem.textContent = note;
            notesList.appendChild(listItem);
        });
        
        notesContainer.appendChild(notesList);
        intelligenceContent.appendChild(notesContainer);
    }

    /**
     * Bind event listeners for detail panel
     */
    bindDetailEventListeners(content, aircraft) {
        // Watchlist toggle button
        const watchlistBtn = content.querySelector('.watchlist-toggle');
        if (watchlistBtn) {
            watchlistBtn.addEventListener('click', () => {
                this.toggleWatchlist(aircraft.hex);
            });
        }
        
        // Track aircraft button
        const trackBtn = content.querySelector('.track-aircraft');
        if (trackBtn) {
            trackBtn.addEventListener('click', () => {
                this.trackAircraft(aircraft);
            });
        }
        
        // View history button
        const historyBtn = content.querySelector('.view-history');
        if (historyBtn) {
            historyBtn.addEventListener('click', () => {
                this.viewAircraftHistory(aircraft.hex);
            });
        }
    }

    /**
     * Toggle aircraft in watchlist
     */
    toggleWatchlist(hex) {
        if (!this.store || !hex) return;
        
        const currentWatchlist = this.store.getState().user.watchlist || [];
        const isWatched = currentWatchlist.includes(hex);
        
        let newWatchlist;
        if (isWatched) {
            newWatchlist = currentWatchlist.filter(item => item !== hex);
        } else {
            newWatchlist = [...currentWatchlist, hex];
        }
        
        this.store.setState('user.watchlist', newWatchlist);
        
        // Persist to storage
        this.store.persistState(['user']);
    }

    /**
     * Track aircraft on map
     */
    trackAircraft(aircraft) {
        if (!aircraft.lat || !aircraft.lon) return;
        
        // Focus map on aircraft
        const mapComponent = window.OSINTTracker?.components?.get('map');
        if (mapComponent) {
            mapComponent.flyToAircraft(aircraft);
        }
    }

    /**
     * View aircraft history
     */
    viewAircraftHistory(hex) {
        // TODO: Implement aircraft history view
        console.log(`View history for aircraft: ${hex}`);
    }

    /**
     * Update watchlist button state
     */
    updateWatchlistButton(watchlist) {
        if (!this.currentAircraft) return;
        
        const watchlistBtn = this.container.querySelector('.watchlist-toggle');
        if (!watchlistBtn) return;
        
        const isWatched = watchlist.includes(this.currentAircraft.hex);
        watchlistBtn.dataset.action = isWatched ? 'remove' : 'add';
        
        const icon = watchlistBtn.querySelector('i');
        if (icon) {
            icon.className = isWatched ? 'icon-bookmark-filled' : 'icon-bookmark';
        }
    }

    /**
     * Start live data updates
     */
    startLiveUpdates() {
        this.stopLiveUpdates(); // Clear any existing interval
        
        this.updateInterval = setInterval(() => {
            if (this.currentAircraft) {
                this.refreshLiveData();
            }
        }, this.updateFrequency);
    }

    /**
     * Stop live data updates
     */
    stopLiveUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Refresh live telemetry data
     */
    refreshLiveData() {
        if (!this.currentAircraft || !this.store) return;
        
        const aircraftMap = this.store.getState().live.aircraft;
        const updatedAircraft = aircraftMap ? aircraftMap.get(this.currentAircraft.hex) : null;
        
        if (updatedAircraft) {
            // Update only the telemetry section to avoid full re-render
            this.updateTelemetryDisplay(updatedAircraft);
            this.currentAircraft = { ...this.currentAircraft, ...updatedAircraft };
        }
    }

    /**
     * Update telemetry display with current data
     */
    updateTelemetryDisplay(aircraft) {
        // Update altitude
        const altitudeElement = this.container.querySelector('.altitude');
        if (altitudeElement && aircraft.altitude !== undefined) {
            altitudeElement.textContent = aircraft.altitude ? 
                `${aircraft.altitude.toLocaleString()}ft` : 'N/A';
        }
        
        // Update speed
        const speedElement = this.container.querySelector('.speed');
        if (speedElement && aircraft.groundSpeed !== undefined) {
            speedElement.textContent = aircraft.groundSpeed ? 
                `${aircraft.groundSpeed}kts` : 'N/A';
        }
        
        // Update heading
        const headingElement = this.container.querySelector('.heading');
        if (headingElement && aircraft.track !== undefined) {
            headingElement.textContent = aircraft.track !== null ? 
                `${aircraft.track}°` : 'N/A';
        }
        
        // Update squawk
        const squawkElement = this.container.querySelector('.squawk');
        if (squawkElement) {
            squawkElement.textContent = aircraft.squawk || 'N/A';
            
            // Update emergency highlighting
            if (aircraft.emergency) {
                squawkElement.style.color = '#ff0000';
                squawkElement.style.fontWeight = 'bold';
            } else {
                squawkElement.style.color = '';
                squawkElement.style.fontWeight = '';
            }
        }
    }

    /**
     * Hide details panel
     */
    hideDetails() {
        this.currentAircraft = null;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="error-message">
                    <i class="icon-alert"></i>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    /**
     * Get aircraft icon based on type and status
     */
    getAircraftIcon(category, military) {
        const baseIcons = {
            fighter: '🛩️',
            bomber: '✈️',
            transport: '🛫',
            tanker: '⛽',
            surveillance: '📡',
            helicopter: '🚁',
            vip: '🏛️'
        };
        
        return baseIcons[category] || (military ? '🛩️' : '✈️');
    }

    /**
     * Format significance rating for display
     */
    formatSignificanceRating(rating) {
        const levels = {
            1: 'Low',
            2: 'Low-Medium',
            3: 'Medium',
            4: 'High',
            5: 'Critical'
        };
        
        return levels[rating] || 'Unknown';
    }

    /**
     * Format mission type for display
     */
    formatMissionType(missionType) {
        const types = {
            unknown: 'Unknown',
            combat_air_patrol: 'Combat Air Patrol',
            strategic_mission: 'Strategic Mission',
            intelligence_gathering: 'Intelligence Gathering',
            air_refueling: 'Air Refueling',
            logistics: 'Logistics',
            vip_transport: 'VIP Transport',
            emergency: 'Emergency',
            training: 'Training'
        };
        
        return types[missionType] || missionType.replace(/_/g, ' ').toUpperCase();
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopLiveUpdates();
        this.currentAircraft = null;
        this.container = null;
        
        console.log('📊 Aircraft Details Panel destroyed');
    }
}