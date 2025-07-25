/**
 * Military Air-Traffic Intelligence System
 * Main Application Module
 * 
 * Implements Blueprint A: API-Centric Architecture
 * Data Sources: adsb.fi and ADSB.lol public APIs
 */

class MilitaryFlightTracker {
    constructor() {
        this.aircraftDatabase = new AircraftDatabase();
        this.map = null;
        this.aircraftMarkers = new Map();
        this.aircraftData = new Map();
        this.settings = this.loadSettings();
        this.updateInterval = null;
        this.lastUpdate = null;
        this.isConnected = false;
        this.showTrails = false;
        this.showLabels = true;
        this.enabledFilters = ['fighter', 'transport', 'tanker', 'surveillance', 'helicopter'];
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        this.initializeMap();
        this.bindEventListeners();
        this.updateStatus('Connecting...', 'connecting');
        
        // Start data fetching
        await this.fetchMilitaryAircraft();
        this.startUpdateLoop();
        
        // Update UI
        this.updateFilters();
        this.updateStatistics();
    }

    /**
     * Initialize the Leaflet map
     */
    initializeMap() {
        // Initialize map centered on continental US
        this.map = L.map('map', {
            center: [39.8283, -98.5795],
            zoom: 4,
            zoomControl: false
        });

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        // Add dark tile layer suitable for military operations
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(this.map);

        // Custom aircraft icon creation function
        this.createAircraftIcon = (aircraft) => {
            const color = this.aircraftDatabase.getAircraftColor(aircraft.category);
            const icon = this.aircraftDatabase.getAircraftIcon(aircraft.category);
            
            return L.divIcon({
                html: `<div style="
                    background: ${color};
                    color: white;
                    border: 2px solid #fff;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    transform: rotate(${aircraft.heading || 0}deg);
                ">${icon}</div>`,
                className: 'aircraft-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
        };
    }

    /**
     * Bind event listeners
     */
    bindEventListeners() {
        // Settings modal
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showModal('settings-modal');
        });

        document.getElementById('settings-close').addEventListener('click', () => {
            this.hideModal('settings-modal');
        });

        // Aircraft detail modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideModal('aircraft-modal');
        });

        // Map controls
        document.getElementById('center-map').addEventListener('click', () => {
            this.centerMapOnAircraft();
        });

        document.getElementById('toggle-trails').addEventListener('click', () => {
            this.toggleTrails();
        });

        document.getElementById('toggle-labels').addEventListener('click', () => {
            this.toggleLabels();
        });

        // Filter checkboxes
        const filterIds = ['filter-fighters', 'filter-transports', 'filter-tankers', 'filter-surveillance', 'filter-helicopters'];
        const filterCategories = ['fighter', 'transport', 'tanker', 'surveillance', 'helicopter'];
        
        filterIds.forEach((id, index) => {
            document.getElementById(id).addEventListener('change', (e) => {
                const category = filterCategories[index];
                if (e.target.checked) {
                    if (!this.enabledFilters.includes(category)) {
                        this.enabledFilters.push(category);
                    }
                } else {
                    this.enabledFilters = this.enabledFilters.filter(f => f !== category);
                }
                this.updateMapDisplay();
            });
        });

        // Settings changes
        document.getElementById('update-interval').addEventListener('change', (e) => {
            this.settings.updateInterval = parseInt(e.target.value);
            this.saveSettings();
            this.restartUpdateLoop();
        });

        document.getElementById('data-source').addEventListener('change', (e) => {
            this.settings.dataSource = e.target.value;
            this.saveSettings();
        });

        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideModal(e.target.id);
            }
        });
    }

    /**
     * Data Source Management with Resilient API Architecture
     */
    getApiEndpoints() {
        return {
            'adsb.fi': {
                base: 'https://opendata.adsb.fi/api',
                military: '/v2/mil',
                rateLimit: 1000, // 1 second between requests
                name: 'adsb.fi (Community)'
            },
            'adsb.lol': {
                base: 'https://api.adsb.lol',
                military: '/v2/mil',
                rateLimit: 500, // 0.5 seconds between requests (no current limit)
                name: 'ADSB.lol (Open Source)'
            }
        };
    }

    /**
     * Fetch military aircraft data with fallback capability
     */
    async fetchMilitaryAircraft() {
        const endpoints = this.getApiEndpoints();
        const primarySource = this.settings.dataSource;
        const fallbackSource = primarySource === 'adsb.fi' ? 'adsb.lol' : 'adsb.fi';

        try {
            // Try primary source first
            const data = await this.fetchFromSource(endpoints[primarySource]);
            if (data && data.ac && data.ac.length > 0) {
                this.processMilitaryData(data, primarySource);
                this.updateStatus(`Connected to ${endpoints[primarySource].name}`, 'connected');
                this.isConnected = true;
                return;
            }
        } catch (error) {
            console.warn(`Primary source ${primarySource} failed:`, error);
        }

        try {
            // Try fallback source
            const data = await this.fetchFromSource(endpoints[fallbackSource]);
            if (data && data.ac) {
                this.processMilitaryData(data, fallbackSource);
                this.updateStatus(`Connected to ${endpoints[fallbackSource].name} (fallback)`, 'connected');
                this.isConnected = true;
                return;
            }
        } catch (error) {
            console.error(`Fallback source ${fallbackSource} failed:`, error);
        }

        // Both sources failed
        this.updateStatus('Connection failed - retrying...', 'error');
        this.isConnected = false;
    }

    /**
     * Fetch data from a specific API source
     */
    async fetchFromSource(endpoint) {
        const response = await fetch(`${endpoint.base}${endpoint.military}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Military-Flight-Tracker/1.0'
            },
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Process military aircraft data
     */
    processMilitaryData(data, source) {
        if (!data.ac || !Array.isArray(data.ac)) {
            console.warn('Invalid data format received from', source);
            return;
        }

        const currentTime = Date.now();
        const newAircraftIds = new Set();

        // Process each aircraft
        data.ac.forEach(aircraft => {
            // Skip aircraft without position data
            if (!aircraft.lat || !aircraft.lon) {
                return;
            }

            // Enrich with OSINT data
            const enrichedAircraft = this.aircraftDatabase.enrichAircraft(aircraft);
            enrichedAircraft.dataSource = source;
            enrichedAircraft.lastSeen = currentTime;

            // Store aircraft data
            this.aircraftData.set(enrichedAircraft.id, enrichedAircraft);
            newAircraftIds.add(enrichedAircraft.id);

            // Update map marker
            this.updateAircraftMarker(enrichedAircraft);
        });

        // Remove aircraft that are no longer present (haven't been seen for 5 minutes)
        const staleThreshold = currentTime - (5 * 60 * 1000);
        for (const [id, aircraft] of this.aircraftData.entries()) {
            if (aircraft.lastSeen < staleThreshold) {
                this.removeAircraftMarker(id);
                this.aircraftData.delete(id);
            }
        }

        this.lastUpdate = currentTime;
        this.updateSidebar();
        this.updateStatistics();
    }

    /**
     * Update aircraft marker on map
     */
    updateAircraftMarker(aircraft) {
        const position = [aircraft.lat, aircraft.lon];
        
        if (this.aircraftMarkers.has(aircraft.id)) {
            // Update existing marker
            const marker = this.aircraftMarkers.get(aircraft.id);
            marker.setLatLng(position);
            marker.setIcon(this.createAircraftIcon(aircraft));
        } else {
            // Create new marker
            const marker = L.marker(position, {
                icon: this.createAircraftIcon(aircraft)
            }).addTo(this.map);

            // Create popup with aircraft details
            const popupContent = this.createPopupContent(aircraft);
            marker.bindPopup(popupContent);

            // Add click handler for detailed view
            marker.on('click', () => {
                this.showAircraftDetails(aircraft);
            });

            this.aircraftMarkers.set(aircraft.id, marker);
        }
    }

    /**
     * Remove aircraft marker from map
     */
    removeAircraftMarker(aircraftId) {
        if (this.aircraftMarkers.has(aircraftId)) {
            this.map.removeLayer(this.aircraftMarkers.get(aircraftId));
            this.aircraftMarkers.delete(aircraftId);
        }
    }

    /**
     * Create popup content for aircraft
     */
    createPopupContent(aircraft) {
        const callsign = aircraft.flight || 'Unknown';
        const type = aircraft.aircraftName || aircraft.t || 'Unknown';
        const altitude = aircraft.altitude ? `${aircraft.altitude.toLocaleString()}ft` : 'Unknown';
        const speed = aircraft.speed ? `${aircraft.speed}kts` : 'Unknown';
        const country = aircraft.countryInfo ? `${aircraft.countryInfo.flag} ${aircraft.countryInfo.name}` : '';

        return `
            <div class="aircraft-popup">
                <div class="callsign">${callsign}</div>
                <div class="detail"><span class="label">Type:</span>${type}</div>
                <div class="detail"><span class="label">Altitude:</span>${altitude}</div>
                <div class="detail"><span class="label">Speed:</span>${speed}</div>
                ${country ? `<div class="detail"><span class="label">Country:</span>${country}</div>` : ''}
                <div class="detail"><span class="label">Category:</span>${aircraft.category}</div>
            </div>
        `;
    }

    /**
     * Update sidebar aircraft list
     */
    updateSidebar() {
        const aircraftList = document.getElementById('aircraft-list');
        const filteredAircraft = this.aircraftDatabase.filterByCategory(
            Array.from(this.aircraftData.values()),
            this.enabledFilters
        );

        // Sort by significance and category priority
        filteredAircraft.sort((a, b) => {
            const priorityA = a.categoryInfo?.priority || 5;
            const priorityB = b.categoryInfo?.priority || 5;
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return (b.intelligence?.significance || 0) - (a.intelligence?.significance || 0);
        });

        aircraftList.innerHTML = '';

        filteredAircraft.forEach(aircraft => {
            const item = document.createElement('div');
            item.className = 'aircraft-item';
            item.addEventListener('click', () => {
                this.showAircraftDetails(aircraft);
                this.map.setView([aircraft.lat, aircraft.lon], 10);
            });

            const callsign = aircraft.flight || 'Unknown';
            const type = aircraft.aircraftName || aircraft.t || 'Unknown';
            const country = aircraft.countryInfo ? aircraft.countryInfo.flag : '';

            item.innerHTML = `
                <div class="aircraft-callsign">${country} ${callsign}</div>
                <div class="aircraft-type">${type}</div>
                <div class="aircraft-details">
                    <div>Alt: ${aircraft.altitude ? aircraft.altitude.toLocaleString() + 'ft' : 'N/A'}</div>
                    <div>Spd: ${aircraft.speed || 'N/A'}kts</div>
                    <div>Cat: ${aircraft.category}</div>
                    <div>Sig: ${aircraft.intelligence?.significance || 1}/5</div>
                </div>
            `;

            aircraftList.appendChild(item);
        });

        // Update aircraft count
        document.getElementById('aircraft-count').textContent = filteredAircraft.length;
    }

    /**
     * Show detailed aircraft information modal
     */
    showAircraftDetails(aircraft) {
        const modal = document.getElementById('aircraft-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        const callsign = aircraft.flight || 'Unknown';
        const type = aircraft.aircraftName || aircraft.t || 'Unknown';
        
        title.textContent = `${callsign} - ${type}`;

        // Generate research links
        const links = this.aircraftDatabase.generateResearchLinks(aircraft);
        const nNumber = this.aircraftDatabase.icaoToNNumber(aircraft.hex);

        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-label">Callsign</span>
                    <span class="detail-value">${callsign}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Aircraft Type</span>
                    <span class="detail-value">${type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">ICAO Hex</span>
                    <span class="detail-value">${aircraft.hex || 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Registration</span>
                    <span class="detail-value">${nNumber || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Altitude</span>
                    <span class="detail-value">${aircraft.altitude ? aircraft.altitude.toLocaleString() + ' ft' : 'Unknown'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Ground Speed</span>
                    <span class="detail-value">${aircraft.speed || 'Unknown'} kts</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Heading</span>
                    <span class="detail-value">${aircraft.heading || 'Unknown'}°</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Category</span>
                    <span class="detail-value">${aircraft.category}</span>
                </div>
            </div>

            ${aircraft.countryInfo ? `
                <div class="detail-item" style="margin: 1rem 0;">
                    <span class="detail-label">Country</span>
                    <span class="detail-value">${aircraft.countryInfo.flag} ${aircraft.countryInfo.name}</span>
                </div>
            ` : ''}

            ${aircraft.intelligence ? `
                <div style="margin: 1.5rem 0;">
                    <h4>Intelligence Assessment</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Significance</span>
                            <span class="detail-value">${aircraft.intelligence.significance}/5</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Mission Type</span>
                            <span class="detail-value">${aircraft.intelligence.missionType}</span>
                        </div>
                    </div>
                    ${aircraft.intelligence.notes.length > 0 ? `
                        <div style="margin-top: 1rem;">
                            <strong>Analysis Notes:</strong>
                            <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                                ${aircraft.intelligence.notes.map(note => `<li>${note}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            ` : ''}

            <div style="margin: 1.5rem 0;">
                <h4>External Research Links</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
                    ${Object.entries(links).map(([name, url]) => `
                        <a href="${url}" target="_blank" style="color: var(--accent-color); text-decoration: none; padding: 0.25rem; background: var(--secondary-color); border-radius: 0.25rem; text-align: center;">
                            ${name.charAt(0).toUpperCase() + name.slice(1)}
                        </a>
                    `).join('')}
                </div>
            </div>

            <div style="margin: 1rem 0; padding: 1rem; background: var(--secondary-color); border-radius: 0.25rem;">
                <small>
                    <strong>Data Source:</strong> ${aircraft.dataSource} | 
                    <strong>Last Update:</strong> ${new Date(aircraft.lastSeen).toLocaleTimeString()}
                </small>
            </div>
        `;

        this.showModal('aircraft-modal');
    }

    /**
     * Update map display based on filters
     */
    updateMapDisplay() {
        this.aircraftMarkers.forEach((marker, id) => {
            const aircraft = this.aircraftData.get(id);
            if (aircraft && this.enabledFilters.includes(aircraft.category)) {
                marker.addTo(this.map);
            } else {
                this.map.removeLayer(marker);
            }
        });
        this.updateSidebar();
    }

    /**
     * Center map on visible aircraft
     */
    centerMapOnAircraft() {
        const visibleAircraft = Array.from(this.aircraftData.values())
            .filter(aircraft => this.enabledFilters.includes(aircraft.category));

        if (visibleAircraft.length === 0) return;

        if (visibleAircraft.length === 1) {
            const aircraft = visibleAircraft[0];
            this.map.setView([aircraft.lat, aircraft.lon], 8);
        } else {
            const group = new L.featureGroup(
                visibleAircraft.map(aircraft => this.aircraftMarkers.get(aircraft.id))
                    .filter(marker => marker)
            );
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    }

    /**
     * Toggle flight trails (placeholder for future implementation)
     */
    toggleTrails() {
        this.showTrails = !this.showTrails;
        const btn = document.getElementById('toggle-trails');
        btn.classList.toggle('active', this.showTrails);
        // TODO: Implement trail tracking
    }

    /**
     * Toggle aircraft labels
     */
    toggleLabels() {
        this.showLabels = !this.showLabels;
        const btn = document.getElementById('toggle-labels');
        btn.classList.toggle('active', this.showLabels);
        // TODO: Implement label toggle
    }

    /**
     * Update status indicator
     */
    updateStatus(message, status) {
        const statusElement = document.getElementById('status');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('.status-text');
        
        text.textContent = message;
        dot.className = `status-dot ${status}`;
    }

    /**
     * Update statistics
     */
    updateStatistics() {
        document.getElementById('total-tracked').textContent = this.aircraftData.size;
        document.getElementById('last-update').textContent = 
            this.lastUpdate ? new Date(this.lastUpdate).toLocaleTimeString() : '--:--';
    }

    /**
     * Update filter checkboxes
     */
    updateFilters() {
        const filterMap = {
            'filter-fighters': 'fighter',
            'filter-transports': 'transport',
            'filter-tankers': 'tanker',
            'filter-surveillance': 'surveillance',
            'filter-helicopters': 'helicopter'
        };

        Object.entries(filterMap).forEach(([id, category]) => {
            document.getElementById(id).checked = this.enabledFilters.includes(category);
        });
    }

    /**
     * Modal management
     */
    showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    hideModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    /**
     * Settings management
     */
    loadSettings() {
        const defaultSettings = {
            updateInterval: 10,
            dataSource: 'adsb.fi',
            enableSounds: true,
            enablePatterns: true
        };

        try {
            const saved = localStorage.getItem('militaryTracker.settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch {
            return defaultSettings;
        }
    }

    saveSettings() {
        localStorage.setItem('militaryTracker.settings', JSON.stringify(this.settings));
    }

    /**
     * Update loop management
     */
    startUpdateLoop() {
        this.updateInterval = setInterval(() => {
            this.fetchMilitaryAircraft();
        }, this.settings.updateInterval * 1000);
    }

    restartUpdateLoop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        this.startUpdateLoop();
    }

    /**
     * Cleanup on page unload
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.militaryTracker = new MilitaryFlightTracker();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.militaryTracker) {
            window.militaryTracker.destroy();
        }
    });
});