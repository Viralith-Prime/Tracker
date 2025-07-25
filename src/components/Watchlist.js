/**
 * Watchlist Component
 * 
 * Manages tracked aircraft and provides quick access to monitored assets.
 * Displays watched aircraft with real-time status updates.
 */

import { DOMOptimizer } from '../utils/performance.js';

/**
 * Watchlist component class
 * Manages the user's aircraft watchlist
 */
export class Watchlist {
    constructor(options = {}) {
        this.store = options.store;
        this.aircraftDB = options.aircraftDB;
        this.container = null;
        this.isInitialized = false;
        
        // Watchlist data
        this.watchedAircraft = new Map();
        
        console.log('📋 Watchlist component initialized');
    }

    /**
     * Initialize the component
     */
    async initialize() {
        try {
            // Find the container
            this.container = document.querySelector('#watchlist-container');
            if (!this.container) {
                throw new Error('Watchlist container not found');
            }
            
            // Subscribe to store changes
            this.subscribeToStore();
            
            // Initial render
            await this.render();
            
            this.isInitialized = true;
            console.log('✅ Watchlist initialized successfully');
            
        } catch (error) {
            console.error('❌ Watchlist initialization failed:', error);
            throw error;
        }
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        if (!this.store) return;
        
        // Subscribe to watchlist changes
        this.store.subscribe('user.watchlist', (path, watchlist) => {
            this.updateWatchedAircraft(watchlist);
        });
        
        // Subscribe to aircraft data updates
        this.store.subscribe('live.aircraft', (path, aircraftMap) => {
            this.updateAircraftData(aircraftMap);
        });
    }

    /**
     * Render the watchlist
     */
    async render() {
        const watchlist = this.store?.getState().user.watchlist || [];
        
        if (watchlist.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        await this.renderWatchlistItems(watchlist);
    }

    /**
     * Render empty watchlist state
     */
    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h4>No Aircraft Watched</h4>
                <p>Click on any aircraft on the map to add it to your watchlist.</p>
                <div class="empty-actions">
                    <button class="btn btn-primary" id="add-sample-aircraft">
                        <i class="icon-plus"></i>
                        Add Sample Aircraft
                    </button>
                </div>
            </div>
        `;
        
        // Bind sample aircraft button
        const sampleBtn = this.container.querySelector('#add-sample-aircraft');
        if (sampleBtn) {
            sampleBtn.addEventListener('click', () => this.addSampleAircraft());
        }
    }

    /**
     * Render watchlist items
     */
    async renderWatchlistItems(watchlist) {
        const template = document.getElementById('watchlist-item-template');
        if (!template) {
            console.error('Watchlist item template not found');
            return;
        }
        
        const fragment = document.createDocumentFragment();
        const aircraftMap = this.store?.getState().live.aircraft || new Map();
        
        for (const hex of watchlist) {
            const aircraft = aircraftMap.get(hex);
            const enrichedAircraft = aircraft && this.aircraftDB ? 
                await this.aircraftDB.enrichAircraft(aircraft) : aircraft;
            
            const item = this.createWatchlistItem(template, hex, enrichedAircraft);
            fragment.appendChild(item);
        }
        
        await DOMOptimizer.replaceContent(this.container, fragment);
    }

    /**
     * Create a watchlist item element
     */
    createWatchlistItem(template, hex, aircraft) {
        const item = template.content.cloneNode(true);
        const container = item.querySelector('.watchlist-item');
        
        if (!container) return item;
        
        // Set data attributes
        container.dataset.hex = hex;
        
        if (aircraft) {
            // Aircraft is currently visible
            container.classList.remove('offline');
            
            // Basic info
            const callsign = item.querySelector('.aircraft-callsign');
            if (callsign) {
                callsign.textContent = aircraft.flight || hex;
            }
            
            const type = item.querySelector('.aircraft-type');
            if (type) {
                type.textContent = aircraft.name || aircraft.icaoType || 'Unknown';
            }
            
            // Status indicator
            const status = item.querySelector('.status-indicator');
            if (status) {
                if (aircraft.emergency) {
                    status.className = 'status-indicator emergency';
                    status.title = 'Emergency';
                } else if (aircraft.military) {
                    status.className = 'status-indicator military';
                    status.title = 'Military';
                } else {
                    status.className = 'status-indicator active';
                    status.title = 'Active';
                }
            }
            
            // Telemetry
            const altitude = item.querySelector('.altitude');
            if (altitude) {
                altitude.textContent = aircraft.altitude ? 
                    `${aircraft.altitude.toLocaleString()}ft` : 'N/A';
            }
            
            const speed = item.querySelector('.speed');
            if (speed) {
                speed.textContent = aircraft.groundSpeed ? 
                    `${aircraft.groundSpeed}kts` : 'N/A';
            }
            
            // Last seen
            const lastSeen = item.querySelector('.last-seen');
            if (lastSeen) {
                lastSeen.textContent = 'Live';
            }
            
        } else {
            // Aircraft is offline
            container.classList.add('offline');
            
            // Try to get cached data
            const cachedData = this.watchedAircraft.get(hex);
            
            const callsign = item.querySelector('.aircraft-callsign');
            if (callsign) {
                callsign.textContent = cachedData?.callsign || hex;
            }
            
            const type = item.querySelector('.aircraft-type');
            if (type) {
                type.textContent = cachedData?.type || 'Unknown';
            }
            
            const status = item.querySelector('.status-indicator');
            if (status) {
                status.className = 'status-indicator offline';
                status.title = 'Offline';
            }
            
            const altitude = item.querySelector('.altitude');
            if (altitude) {
                altitude.textContent = 'N/A';
            }
            
            const speed = item.querySelector('.speed');
            if (speed) {
                speed.textContent = 'N/A';
            }
            
            const lastSeen = item.querySelector('.last-seen');
            if (lastSeen) {
                const lastSeenTime = cachedData?.lastSeen;
                if (lastSeenTime) {
                    lastSeen.textContent = this.formatLastSeen(lastSeenTime);
                } else {
                    lastSeen.textContent = 'Unknown';
                }
            }
        }
        
        // Bind event listeners
        this.bindWatchlistItemEvents(container, hex);
        
        return item;
    }

    /**
     * Bind event listeners to watchlist item
     */
    bindWatchlistItemEvents(container, hex) {
        // Click to select aircraft
        container.addEventListener('click', (e) => {
            if (!e.target.closest('.remove-btn')) {
                this.selectAircraft(hex);
            }
        });
        
        // Remove button
        const removeBtn = container.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFromWatchlist(hex);
            });
        }
        
        // Track button
        const trackBtn = container.querySelector('.track-btn');
        if (trackBtn) {
            trackBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.trackAircraft(hex);
            });
        }
    }

    /**
     * Update watched aircraft data
     */
    updateWatchedAircraft(watchlist) {
        // Clean up aircraft no longer watched
        for (const hex of this.watchedAircraft.keys()) {
            if (!watchlist.includes(hex)) {
                this.watchedAircraft.delete(hex);
            }
        }
        
        // Re-render the watchlist
        this.render();
    }

    /**
     * Update aircraft data from live feed
     */
    updateAircraftData(aircraftMap) {
        if (!aircraftMap) return;
        
        const watchlist = this.store?.getState().user.watchlist || [];
        
        // Update cached data for watched aircraft
        for (const hex of watchlist) {
            const aircraft = aircraftMap.get(hex);
            if (aircraft) {
                this.watchedAircraft.set(hex, {
                    callsign: aircraft.flight || hex,
                    type: aircraft.icaoType || 'Unknown',
                    lastSeen: Date.now()
                });
            }
        }
        
        // Update UI for visible aircraft
        this.updateVisibleAircraftData(aircraftMap);
    }

    /**
     * Update visible aircraft data in the UI
     */
    updateVisibleAircraftData(aircraftMap) {
        const items = this.container.querySelectorAll('.watchlist-item');
        
        items.forEach(item => {
            const hex = item.dataset.hex;
            const aircraft = aircraftMap.get(hex);
            
            if (aircraft) {
                // Update live data
                item.classList.remove('offline');
                
                const altitude = item.querySelector('.altitude');
                if (altitude) {
                    altitude.textContent = aircraft.altitude ? 
                        `${aircraft.altitude.toLocaleString()}ft` : 'N/A';
                }
                
                const speed = item.querySelector('.speed');
                if (speed) {
                    speed.textContent = aircraft.groundSpeed ? 
                        `${aircraft.groundSpeed}kts` : 'N/A';
                }
                
                const lastSeen = item.querySelector('.last-seen');
                if (lastSeen) {
                    lastSeen.textContent = 'Live';
                }
                
                // Update status
                const status = item.querySelector('.status-indicator');
                if (status) {
                    if (aircraft.emergency) {
                        status.className = 'status-indicator emergency';
                        status.title = 'Emergency';
                    } else if (aircraft.military) {
                        status.className = 'status-indicator military';
                        status.title = 'Military';
                    } else {
                        status.className = 'status-indicator active';
                        status.title = 'Active';
                    }
                }
            } else {
                // Aircraft went offline
                item.classList.add('offline');
                
                const status = item.querySelector('.status-indicator');
                if (status) {
                    status.className = 'status-indicator offline';
                    status.title = 'Offline';
                }
                
                const lastSeen = item.querySelector('.last-seen');
                if (lastSeen && lastSeen.textContent === 'Live') {
                    lastSeen.textContent = this.formatLastSeen(Date.now());
                }
            }
        });
    }

    /**
     * Select aircraft and show details
     */
    selectAircraft(hex) {
        if (!this.store) return;
        
        this.store.setState('ui.selectedAircraftHex', hex);
        this.store.setState('ui.isDetailsPanelOpen', true);
        
        // Highlight selected item
        const items = this.container.querySelectorAll('.watchlist-item');
        items.forEach(item => {
            item.classList.toggle('selected', item.dataset.hex === hex);
        });
    }

    /**
     * Remove aircraft from watchlist
     */
    removeFromWatchlist(hex) {
        if (!this.store) return;
        
        const currentWatchlist = this.store.getState().user.watchlist || [];
        const newWatchlist = currentWatchlist.filter(item => item !== hex);
        
        this.store.setState('user.watchlist', newWatchlist);
        this.store.persistState(['user']);
    }

    /**
     * Track aircraft on map
     */
    trackAircraft(hex) {
        const aircraftMap = this.store?.getState().live.aircraft;
        const aircraft = aircraftMap?.get(hex);
        
        if (aircraft && aircraft.lat && aircraft.lon) {
            // Focus map on aircraft
            const mapComponent = window.OSINTTracker?.components?.get('map');
            if (mapComponent) {
                mapComponent.flyToAircraft(aircraft);
            }
        }
    }

    /**
     * Add sample aircraft for demonstration
     */
    addSampleAircraft() {
        if (!this.store) return;
        
        const sampleHex = 'AE01CE'; // Example US military hex
        const currentWatchlist = this.store.getState().user.watchlist || [];
        
        if (!currentWatchlist.includes(sampleHex)) {
            const newWatchlist = [...currentWatchlist, sampleHex];
            this.store.setState('user.watchlist', newWatchlist);
            this.store.persistState(['user']);
        }
    }

    /**
     * Format last seen timestamp
     */
    formatLastSeen(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }
    }

    /**
     * Get watchlist statistics
     */
    getStatistics() {
        const watchlist = this.store?.getState().user.watchlist || [];
        const aircraftMap = this.store?.getState().live.aircraft || new Map();
        
        let activeCount = 0;
        let offlineCount = 0;
        let emergencyCount = 0;
        let militaryCount = 0;
        
        for (const hex of watchlist) {
            const aircraft = aircraftMap.get(hex);
            if (aircraft) {
                activeCount++;
                if (aircraft.emergency) emergencyCount++;
                if (aircraft.military) militaryCount++;
            } else {
                offlineCount++;
            }
        }
        
        return {
            total: watchlist.length,
            active: activeCount,
            offline: offlineCount,
            emergency: emergencyCount,
            military: militaryCount
        };
    }

    /**
     * Export watchlist data
     */
    exportWatchlist() {
        const watchlist = this.store?.getState().user.watchlist || [];
        const data = {
            watchlist,
            cachedData: Object.fromEntries(this.watchedAircraft.entries()),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
        
        return data;
    }

    /**
     * Import watchlist data
     */
    importWatchlist(data) {
        if (!data || !Array.isArray(data.watchlist)) {
            throw new Error('Invalid watchlist data format');
        }
        
        if (this.store) {
            this.store.setState('user.watchlist', data.watchlist);
            this.store.persistState(['user']);
        }
        
        if (data.cachedData) {
            for (const [hex, cachedData] of Object.entries(data.cachedData)) {
                this.watchedAircraft.set(hex, cachedData);
            }
        }
        
        this.render();
    }

    /**
     * Clear all watched aircraft
     */
    clearWatchlist() {
        if (!this.store) return;
        
        if (confirm('Are you sure you want to clear your entire watchlist?')) {
            this.store.setState('user.watchlist', []);
            this.store.persistState(['user']);
            this.watchedAircraft.clear();
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.watchedAircraft.clear();
        this.container = null;
        
        console.log('📋 Watchlist component destroyed');
    }
}