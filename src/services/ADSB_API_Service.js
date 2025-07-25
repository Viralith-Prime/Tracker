/**
 * ADS-B API Service
 * 
 * Handles efficient data fetching, decompression, and normalization from
 * multiple unfiltered ADS-B data sources as specified in the blueprint.
 */

import { WorkerPool } from '../utils/performance.js';

/**
 * ADS-B API Service class
 * Manages data fetching from multiple sources with automatic fallback
 */
export class ADSB_API_Service {
    constructor(options = {}) {
        this.config = {
            primarySource: 'adsb.fi',
            updateInterval: 5000, // 5 seconds
            maxRetries: 3,
            retryDelay: 2000,
            timeout: 10000,
            enableCompression: true,
            enableWorkers: true,
            workerPoolSize: 2,
            ...options
        };

        // API endpoints configuration
        this.endpoints = {
            'adsb.fi': {
                base: 'https://api.adsb.fi/v2',
                military: '/mil',
                rateLimit: 1000, // 1 request per second
                requiresAuth: false,
                supportsCompression: true
            },
            'adsb.lol': {
                base: 'https://api.adsb.lol/v2',
                military: '/mil',
                rateLimit: 0, // No rate limit currently
                requiresAuth: false,
                supportsCompression: true
            }
        };

        // Service state
        this.isRunning = false;
        this.currentSource = this.config.primarySource;
        this.lastUpdate = null;
        this.updateTimer = null;
        this.retryCount = 0;
        this.statistics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            bytesReceived: 0,
            aircraftReceived: 0
        };

        // Worker pool for heavy processing
        this.workerPool = null;
        if (this.config.enableWorkers) {
            this.initializeWorkerPool();
        }

        // Rate limiting
        this.rateLimiter = new Map();
        
        // Event callbacks
        this.onDataReceived = this.config.onDataReceived || (() => {});
        this.onError = this.config.onError || (() => {});
        this.onStatusChange = this.config.onStatusChange || (() => {});

        console.log('🛰️ ADS-B API Service initialized');
    }

    /**
     * Initialize Web Worker pool for data processing
     */
    initializeWorkerPool() {
        try {
            // Create a worker script blob for data processing
            const workerScript = this.createWorkerScript();
            const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(workerBlob);
            
            this.workerPool = new WorkerPool(workerUrl, this.config.workerPoolSize);
            console.log('👷 Worker pool initialized for data processing');
        } catch (error) {
            console.warn('Could not initialize worker pool:', error);
            this.config.enableWorkers = false;
        }
    }

    /**
     * Create Web Worker script for data processing
     */
    createWorkerScript() {
        return `
            // Import pako for gzip decompression (if available)
            importScripts('https://unpkg.com/pako@2.1.0/dist/pako.min.js');
            
            self.onmessage = function(event) {
                const { id, data } = event.data;
                
                try {
                    let result;
                    
                    if (data.type === 'decompress') {
                        // Decompress gzipped data
                        const decompressed = pako.inflate(data.payload, { to: 'string' });
                        result = JSON.parse(decompressed);
                    } else if (data.type === 'normalize') {
                        // Normalize aircraft data
                        result = normalizeAircraftData(data.payload);
                    } else if (data.type === 'filter') {
                        // Filter aircraft data
                        result = filterAircraftData(data.payload, data.criteria);
                    }
                    
                    self.postMessage({ id, result });
                } catch (error) {
                    self.postMessage({ id, error: error.message });
                }
            };
            
            function normalizeAircraftData(rawData) {
                if (!rawData || !rawData.ac) return [];
                
                return rawData.ac.map(aircraft => ({
                    // Core identification
                    hex: aircraft.hex,
                    flight: aircraft.flight ? aircraft.flight.trim() : null,
                    registration: aircraft.r || null,
                    
                    // Position data
                    lat: aircraft.lat,
                    lon: aircraft.lon,
                    altitude: aircraft.alt_baro || aircraft.alt_geom || null,
                    
                    // Velocity data
                    groundSpeed: aircraft.gs || null,
                    track: aircraft.track || null,
                    verticalRate: aircraft.baro_rate || aircraft.geom_rate || null,
                    
                    // Transponder data
                    squawk: aircraft.squawk || null,
                    
                    // Metadata
                    seen: aircraft.seen || 0,
                    seenPos: aircraft.seen_pos || null,
                    category: aircraft.category || null,
                    
                    // Military/special flags
                    military: aircraft.mil || false,
                    emergency: isEmergencySquawk(aircraft.squawk),
                    
                    // Source metadata
                    source: 'adsb',
                    timestamp: Date.now(),
                    
                    // Raw data preservation
                    raw: aircraft
                }));
            }
            
            function filterAircraftData(aircraft, criteria) {
                return aircraft.filter(ac => {
                    // Filter out aircraft without position
                    if (!ac.lat || !ac.lon) return false;
                    
                    // Filter out stale aircraft (seen > 60 seconds)
                    if (ac.seen > 60) return false;
                    
                    // Apply additional criteria
                    if (criteria.militaryOnly && !ac.military) return false;
                    if (criteria.emergencyOnly && !ac.emergency) return false;
                    if (criteria.minAltitude && ac.altitude < criteria.minAltitude) return false;
                    if (criteria.maxAltitude && ac.altitude > criteria.maxAltitude) return false;
                    
                    return true;
                });
            }
            
            function isEmergencySquawk(squawk) {
                const emergencySquawks = ['7500', '7600', '7700'];
                return emergencySquawks.includes(String(squawk));
            }
        `;
    }

    /**
     * Start the data fetching service
     */
    async start() {
        if (this.isRunning) {
            console.warn('Service is already running');
            return;
        }

        this.isRunning = true;
        this.onStatusChange('starting');
        
        console.log('▶️ Starting ADS-B data fetching...');
        
        try {
            // Initial data fetch
            await this.fetchData();
            
            // Schedule regular updates
            this.scheduleNextUpdate();
            
            this.onStatusChange('connected');
            console.log('✅ ADS-B service started successfully');
            
        } catch (error) {
            this.isRunning = false;
            this.onStatusChange('error');
            this.onError(error);
            throw error;
        }
    }

    /**
     * Stop the data fetching service
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }

        this.onStatusChange('stopped');
        console.log('⏹️ ADS-B service stopped');
    }

    /**
     * Set update interval
     */
    setUpdateInterval(interval) {
        this.config.updateInterval = interval;
        
        if (this.isRunning) {
            // Reschedule with new interval
            if (this.updateTimer) {
                clearTimeout(this.updateTimer);
            }
            this.scheduleNextUpdate();
        }
    }

    /**
     * Fetch data from current source
     */
    async fetchData() {
        const startTime = performance.now();
        this.statistics.totalRequests++;

        try {
            // Check rate limiting
            if (!this.checkRateLimit(this.currentSource)) {
                throw new Error('Rate limit exceeded');
            }

            // Build API URL
            const url = this.buildApiUrl(this.currentSource);
            
            // Fetch data with timeout
            const response = await this.fetchWithTimeout(url, {
                method: 'GET',
                headers: this.getRequestHeaders(),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Process response
            const data = await this.processResponse(response);
            
            // Update statistics
            const responseTime = performance.now() - startTime;
            this.updateStatistics(responseTime, data);
            
            // Reset retry count on success
            this.retryCount = 0;
            this.lastUpdate = Date.now();
            
            // Notify subscribers
            this.onDataReceived(data);
            
            return data;

        } catch (error) {
            this.statistics.failedRequests++;
            console.error('Data fetch failed:', error);
            
            // Attempt fallback or retry
            await this.handleFetchError(error);
            
            throw error;
        }
    }

    /**
     * Process API response (decompress and parse)
     */
    async processResponse(response) {
        const contentEncoding = response.headers.get('content-encoding');
        const contentType = response.headers.get('content-type');
        
        let data;
        
        if (contentEncoding === 'gzip' && this.config.enableCompression) {
            // Handle compressed response
            const arrayBuffer = await response.arrayBuffer();
            
            if (this.config.enableWorkers && this.workerPool) {
                // Use worker for decompression
                data = await this.workerPool.execute({
                    type: 'decompress',
                    payload: new Uint8Array(arrayBuffer)
                });
            } else {
                // Decompress on main thread (fallback)
                const decompressed = pako.inflate(arrayBuffer, { to: 'string' });
                data = JSON.parse(decompressed);
            }
        } else {
            // Handle uncompressed response
            data = await response.json();
        }

        // Normalize data structure
        const normalizedData = await this.normalizeData(data);
        
        return normalizedData;
    }

    /**
     * Normalize data from different sources into consistent format
     */
    async normalizeData(rawData) {
        if (this.config.enableWorkers && this.workerPool) {
            // Use worker for normalization
            return await this.workerPool.execute({
                type: 'normalize',
                payload: rawData
            });
        } else {
            // Normalize on main thread
            return this.normalizeDataSync(rawData);
        }
    }

    /**
     * Synchronous data normalization
     */
    normalizeDataSync(rawData) {
        if (!rawData || !rawData.ac) {
            return [];
        }

        return rawData.ac.map(aircraft => ({
            // Core identification
            hex: aircraft.hex,
            flight: aircraft.flight ? aircraft.flight.trim() : null,
            registration: aircraft.r || null,
            
            // Position data
            lat: aircraft.lat,
            lon: aircraft.lon,
            altitude: aircraft.alt_baro || aircraft.alt_geom || null,
            
            // Velocity data
            groundSpeed: aircraft.gs || null,
            track: aircraft.track || null,
            verticalRate: aircraft.baro_rate || aircraft.geom_rate || null,
            
            // Transponder data
            squawk: aircraft.squawk || null,
            
            // Metadata
            seen: aircraft.seen || 0,
            seenPos: aircraft.seen_pos || null,
            category: aircraft.category || null,
            
            // Military/special flags
            military: aircraft.mil || false,
            emergency: this.isEmergencySquawk(aircraft.squawk),
            
            // Source metadata
            source: this.currentSource,
            timestamp: Date.now(),
            
            // Raw data preservation for debugging
            raw: aircraft
        })).filter(aircraft => 
            // Filter out invalid aircraft
            aircraft.hex && 
            aircraft.lat !== null && 
            aircraft.lon !== null &&
            aircraft.seen < 60 // Not seen for more than 60 seconds
        );
    }

    /**
     * Check if squawk code indicates emergency
     */
    isEmergencySquawk(squawk) {
        const emergencySquawks = ['7500', '7600', '7700'];
        return emergencySquawks.includes(String(squawk));
    }

    /**
     * Build API URL for given source
     */
    buildApiUrl(source) {
        const endpoint = this.endpoints[source];
        if (!endpoint) {
            throw new Error(`Unknown data source: ${source}`);
        }

        return `${endpoint.base}${endpoint.military}`;
    }

    /**
     * Get request headers
     */
    getRequestHeaders() {
        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'OSINT-Aircraft-Tracker/1.0'
        };

        if (this.config.enableCompression) {
            headers['Accept-Encoding'] = 'gzip, deflate';
        }

        return headers;
    }

    /**
     * Check rate limiting for source
     */
    checkRateLimit(source) {
        const endpoint = this.endpoints[source];
        if (!endpoint.rateLimit) {
            return true; // No rate limit
        }

        const now = Date.now();
        const lastRequest = this.rateLimiter.get(source) || 0;
        
        if (now - lastRequest < endpoint.rateLimit) {
            return false;
        }

        this.rateLimiter.set(source, now);
        return true;
    }

    /**
     * Fetch with timeout support
     */
    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Handle fetch errors with fallback logic
     */
    async handleFetchError(error) {
        this.retryCount++;
        
        if (this.retryCount >= this.config.maxRetries) {
            // Try switching to backup source
            await this.switchToBackupSource();
        } else {
            // Wait before retry
            await this.delay(this.config.retryDelay * this.retryCount);
        }
    }

    /**
     * Switch to backup data source
     */
    async switchToBackupSource() {
        const sources = Object.keys(this.endpoints);
        const currentIndex = sources.indexOf(this.currentSource);
        const nextIndex = (currentIndex + 1) % sources.length;
        
        if (nextIndex !== currentIndex) {
            const previousSource = this.currentSource;
            this.currentSource = sources[nextIndex];
            this.retryCount = 0;
            
            console.log(`🔄 Switching from ${previousSource} to ${this.currentSource}`);
            this.onStatusChange('switching');
        } else {
            // No more sources to try
            this.onStatusChange('error');
            throw new Error('All data sources exhausted');
        }
    }

    /**
     * Schedule next data update
     */
    scheduleNextUpdate() {
        if (!this.isRunning) {
            return;
        }

        this.updateTimer = setTimeout(async () => {
            try {
                await this.fetchData();
            } catch (error) {
                console.error('Scheduled fetch failed:', error);
            } finally {
                this.scheduleNextUpdate();
            }
        }, this.config.updateInterval);
    }

    /**
     * Update service statistics
     */
    updateStatistics(responseTime, data) {
        this.statistics.successfulRequests++;
        
        // Update average response time
        const totalRequests = this.statistics.successfulRequests;
        this.statistics.averageResponseTime = 
            ((this.statistics.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;
        
        // Estimate bytes received (rough calculation)
        this.statistics.bytesReceived += JSON.stringify(data).length;
        this.statistics.aircraftReceived += data.length;
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            currentSource: this.currentSource,
            lastUpdate: this.lastUpdate,
            isRunning: this.isRunning,
            uptime: this.lastUpdate ? Date.now() - this.lastUpdate : 0
        };
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stop();
        
        if (this.workerPool) {
            this.workerPool.terminate();
            this.workerPool = null;
        }
        
        this.rateLimiter.clear();
        console.log('🛰️ ADS-B API Service destroyed');
    }
}

/**
 * Emergency squawk code checker utility
 */
export const EmergencySquawks = {
    HIJACK: '7500',
    RADIO_FAILURE: '7600',
    EMERGENCY: '7700',
    
    isEmergency: (squawk) => {
        const emergencySquawks = ['7500', '7600', '7700'];
        return emergencySquawks.includes(String(squawk));
    },
    
    getEmergencyType: (squawk) => {
        switch (String(squawk)) {
            case '7500': return 'HIJACK';
            case '7600': return 'RADIO_FAILURE';
            case '7700': return 'EMERGENCY';
            default: return null;
        }
    }
};

/**
 * Military ICAO range checker
 */
export const MilitaryRanges = {
    // US Military ranges
    US_MILITARY: [
        { start: 0xAE0000, end: 0xAEFFFF }, // US Military
        { start: 0xA00000, end: 0xA3FFFF }  // US Military (additional)
    ],
    
    // Add other country ranges as needed
    UK_MILITARY: [
        { start: 0x400000, end: 0x43FFFF }
    ],
    
    checkMilitary: (hex) => {
        const icaoInt = parseInt(hex, 16);
        
        // Check US ranges
        for (const range of MilitaryRanges.US_MILITARY) {
            if (icaoInt >= range.start && icaoInt <= range.end) {
                return 'US_MILITARY';
            }
        }
        
        // Check UK ranges
        for (const range of MilitaryRanges.UK_MILITARY) {
            if (icaoInt >= range.start && icaoInt <= range.end) {
                return 'UK_MILITARY';
            }
        }
        
        return null;
    }
};