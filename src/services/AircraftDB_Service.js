/**
 * Aircraft Database Service
 * 
 * Provides OSINT enrichment functionality, aircraft identification,
 * and intelligence assessment capabilities as specified in the blueprint.
 */

import { IndexedDBStorage } from '../utils/storage.js';
import { MilitaryRanges } from './ADSB_API_Service.js';

/**
 * Aircraft Database Service class
 * Manages aircraft database and enrichment operations
 */
export class AircraftDB_Service {
    constructor(options = {}) {
        this.config = {
            enableCache: true,
            cacheExpiry: 24 * 60 * 60 * 1000, // 24 hours
            enableRemoteDB: true,
            enableFAARegistry: true,
            ...options
        };

        this.storage = null;
        this.isInitialized = false;
        
        // In-memory caches for performance
        this.aircraftCache = new Map();
        this.icaoTypeCache = new Map();
        this.operatorCache = new Map();
        
        // Aircraft database
        this.aircraftDB = new Map();
        this.aircraftTypes = new Map();
        this.operators = new Map();
        
        // Statistics
        this.stats = {
            enrichmentRequests: 0,
            cacheHits: 0,
            dbLookups: 0,
            unknownAircraft: 0
        };

        console.log('✈️ Aircraft Database Service initialized');
    }

    /**
     * Initialize the service
     */
    async initialize() {
        try {
            // Initialize storage
            this.storage = new IndexedDBStorage('aircraft-db');
            await this.storage.initialize();
            
            // Load built-in aircraft database
            await this.loadBuiltinDatabase();
            
            // Load remote databases if enabled
            if (this.config.enableRemoteDB) {
                await this.loadRemoteDatabase();
            }
            
            // Load cached data
            if (this.config.enableCache) {
                await this.loadCachedData();
            }
            
            this.isInitialized = true;
            console.log('✅ Aircraft Database Service initialized successfully');
            console.log(`📊 Database contains ${this.aircraftDB.size} aircraft records`);
            
        } catch (error) {
            console.error('❌ Aircraft Database Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Load built-in aircraft database
     */
    async loadBuiltinDatabase() {
        // Military aircraft types and characteristics
        const militaryTypes = {
            // US Military Aircraft
            'F16': { 
                name: 'F-16 Fighting Falcon',
                category: 'fighter',
                role: 'Multirole Fighter',
                country: 'USA',
                significance: 4,
                icon: 'fighter-jet'
            },
            'F15': { 
                name: 'F-15 Eagle',
                category: 'fighter',
                role: 'Air Superiority Fighter',
                country: 'USA',
                significance: 5,
                icon: 'fighter-jet'
            },
            'F22': { 
                name: 'F-22 Raptor',
                category: 'fighter',
                role: 'Stealth Fighter',
                country: 'USA',
                significance: 5,
                icon: 'stealth-fighter'
            },
            'F35': { 
                name: 'F-35 Lightning II',
                category: 'fighter',
                role: 'Stealth Multirole Fighter',
                country: 'USA',
                significance: 5,
                icon: 'stealth-fighter'
            },
            'F18': { 
                name: 'F/A-18 Hornet/Super Hornet',
                category: 'fighter',
                role: 'Multirole Fighter',
                country: 'USA',
                significance: 4,
                icon: 'fighter-jet'
            },
            'A10': { 
                name: 'A-10 Thunderbolt II',
                category: 'fighter',
                role: 'Close Air Support',
                country: 'USA',
                significance: 4,
                icon: 'attack-aircraft'
            },
            'B52': { 
                name: 'B-52 Stratofortress',
                category: 'bomber',
                role: 'Strategic Bomber',
                country: 'USA',
                significance: 5,
                icon: 'bomber'
            },
            'B1': { 
                name: 'B-1B Lancer',
                category: 'bomber',
                role: 'Strategic Bomber',
                country: 'USA',
                significance: 5,
                icon: 'bomber'
            },
            'B2': { 
                name: 'B-2 Spirit',
                category: 'bomber',
                role: 'Stealth Bomber',
                country: 'USA',
                significance: 5,
                icon: 'stealth-bomber'
            },
            
            // Transport Aircraft
            'C130': { 
                name: 'C-130 Hercules',
                category: 'transport',
                role: 'Tactical Transport',
                country: 'USA',
                significance: 3,
                icon: 'transport'
            },
            'C17': { 
                name: 'C-17 Globemaster III',
                category: 'transport',
                role: 'Strategic Transport',
                country: 'USA',
                significance: 4,
                icon: 'transport'
            },
            'C5': { 
                name: 'C-5 Galaxy',
                category: 'transport',
                role: 'Heavy Strategic Transport',
                country: 'USA',
                significance: 4,
                icon: 'heavy-transport'
            },
            
            // Tankers
            'KC135': { 
                name: 'KC-135 Stratotanker',
                category: 'tanker',
                role: 'Aerial Refueling',
                country: 'USA',
                significance: 3,
                icon: 'tanker'
            },
            'KC10': { 
                name: 'KC-10 Extender',
                category: 'tanker',
                role: 'Aerial Refueling/Transport',
                country: 'USA',
                significance: 4,
                icon: 'tanker'
            },
            'KC46': { 
                name: 'KC-46 Pegasus',
                category: 'tanker',
                role: 'Aerial Refueling',
                country: 'USA',
                significance: 4,
                icon: 'tanker'
            },
            
            // Surveillance & Electronic Warfare
            'E3': { 
                name: 'E-3 Sentry AWACS',
                category: 'surveillance',
                role: 'Airborne Early Warning',
                country: 'USA',
                significance: 5,
                icon: 'awacs'
            },
            'E8': { 
                name: 'E-8 Joint STARS',
                category: 'surveillance',
                role: 'Ground Surveillance',
                country: 'USA',
                significance: 5,
                icon: 'surveillance'
            },
            'RC135': { 
                name: 'RC-135 Rivet Joint',
                category: 'surveillance',
                role: 'Electronic Intelligence',
                country: 'USA',
                significance: 5,
                icon: 'sigint'
            },
            'U2': { 
                name: 'U-2 Dragon Lady',
                category: 'surveillance',
                role: 'High-altitude Reconnaissance',
                country: 'USA',
                significance: 5,
                icon: 'spy-plane'
            },
            'P8': { 
                name: 'P-8 Poseidon',
                category: 'surveillance',
                role: 'Maritime Patrol',
                country: 'USA',
                significance: 4,
                icon: 'maritime-patrol'
            },
            
            // Special Operations & VIP
            'VC25': { 
                name: 'VC-25A Air Force One',
                category: 'vip',
                role: 'Presidential Transport',
                country: 'USA',
                significance: 5,
                icon: 'vip-transport'
            },
            'C32': { 
                name: 'C-32A Executive Transport',
                category: 'vip',
                role: 'VIP Transport',
                country: 'USA',
                significance: 4,
                icon: 'vip-transport'
            },
            
            // NATO/Allied Aircraft
            'EUFI': { 
                name: 'Eurofighter Typhoon',
                category: 'fighter',
                role: 'Multirole Fighter',
                country: 'NATO',
                significance: 4,
                icon: 'fighter-jet'
            },
            'RFAL': { 
                name: 'Dassault Rafale',
                category: 'fighter',
                role: 'Multirole Fighter',
                country: 'France',
                significance: 4,
                icon: 'fighter-jet'
            },
            'GRIN': { 
                name: 'JAS 39 Gripen',
                category: 'fighter',
                role: 'Multirole Fighter',
                country: 'Sweden',
                significance: 3,
                icon: 'fighter-jet'
            }
        };

        // Store aircraft types
        for (const [code, aircraft] of Object.entries(militaryTypes)) {
            this.aircraftTypes.set(code.toLowerCase(), aircraft);
        }

        // Callsign prefixes for military identification
        const callsignPrefixes = {
            // US Military
            'RCH': { operator: 'US Air Force', type: 'Reach (Transport)', significance: 3 },
            'POLO': { operator: 'US Air Force', type: 'KC-135 Tanker', significance: 3 },
            'SPAR': { operator: 'US Air Force', type: 'Special Air Mission', significance: 4 },
            'GRIM': { operator: 'US Air Force', type: 'A-10 Attack', significance: 4 },
            'AWACS': { operator: 'NATO', type: 'E-3 AWACS', significance: 5 },
            'MAGIC': { operator: 'French Air Force', type: 'E-3F AWACS', significance: 5 },
            'DARKSTAR': { operator: 'US Air Force', type: 'Special Operations', significance: 5 },
            
            // Navy
            'STING': { operator: 'US Navy', type: 'F/A-18 Hornet', significance: 4 },
            'TOPGUN': { operator: 'US Navy', type: 'F/A-18 Aggressor', significance: 3 },
            
            // Special Operations
            'KNIFE': { operator: 'AFSOC', type: 'Special Operations', significance: 5 },
            'SHADOW': { operator: 'CIA/Special Activities', type: 'Covert Operations', significance: 5 }
        };

        // Store callsign data
        for (const [prefix, data] of Object.entries(callsignPrefixes)) {
            this.operatorCache.set(prefix.toLowerCase(), data);
        }

        console.log(`📚 Loaded ${this.aircraftTypes.size} aircraft types and ${this.operatorCache.size} callsign patterns`);
    }

    /**
     * Load remote aircraft database (ADSBexchange, FAA, etc.)
     */
    async loadRemoteDatabase() {
        try {
            // Try to load ADSBexchange aircraft database
            const dbUrl = 'https://raw.githubusercontent.com/adsbxchange/tar1090-db/master/aircraft_db.json';
            
            const response = await fetch(dbUrl, {
                headers: {
                    'User-Agent': 'OSINT-Aircraft-Tracker/1.0'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.processRemoteDatabase(data);
                console.log('📡 Remote aircraft database loaded successfully');
            }
        } catch (error) {
            console.warn('Could not load remote database:', error);
        }
    }

    /**
     * Process remote database data
     */
    processRemoteDatabase(data) {
        let count = 0;
        
        // Process each aircraft record
        for (const [hex, record] of Object.entries(data)) {
            if (record && hex) {
                const aircraftRecord = {
                    hex: hex.toLowerCase(),
                    registration: record.r || null,
                    icaoType: record.t || null,
                    operator: record.o || null,
                    military: record.mil || false,
                    country: record.c || null,
                    built: record.built || null,
                    lastUpdated: Date.now()
                };
                
                this.aircraftDB.set(hex.toLowerCase(), aircraftRecord);
                count++;
            }
        }
        
        console.log(`📊 Processed ${count} aircraft records from remote database`);
    }

    /**
     * Load cached data from IndexedDB
     */
    async loadCachedData() {
        try {
            const cachedDB = await this.storage.getItem('aircraft-database');
            if (cachedDB && cachedDB.timestamp) {
                const age = Date.now() - cachedDB.timestamp;
                if (age < this.config.cacheExpiry) {
                    // Load cached data
                    for (const [hex, record] of Object.entries(cachedDB.data)) {
                        this.aircraftDB.set(hex, record);
                    }
                    console.log(`📂 Loaded ${Object.keys(cachedDB.data).length} cached aircraft records`);
                }
            }
        } catch (error) {
            console.warn('Could not load cached data:', error);
        }
    }

    /**
     * Main enrichment function - adds intelligence to aircraft data
     */
    async enrichAircraft(rawAircraft) {
        this.stats.enrichmentRequests++;
        
        if (!rawAircraft || !rawAircraft.hex) {
            return rawAircraft;
        }

        const hex = rawAircraft.hex.toLowerCase();
        
        // Check cache first
        if (this.aircraftCache.has(hex)) {
            this.stats.cacheHits++;
            const cached = this.aircraftCache.get(hex);
            return { ...rawAircraft, ...cached };
        }

        // Create enriched aircraft object
        const enriched = { ...rawAircraft };
        
        // Database lookup
        const dbRecord = await this.lookupAircraft(hex);
        if (dbRecord) {
            this.stats.dbLookups++;
            Object.assign(enriched, dbRecord);
        }
        
        // ICAO type enrichment
        if (enriched.icaoType) {
            const typeData = this.getAircraftTypeData(enriched.icaoType);
            if (typeData) {
                Object.assign(enriched, typeData);
            }
        }
        
        // Callsign analysis
        if (enriched.flight) {
            const callsignData = this.analyzeCallsign(enriched.flight);
            if (callsignData) {
                enriched.callsignInfo = callsignData;
                if (!enriched.operator && callsignData.operator) {
                    enriched.operator = callsignData.operator;
                }
            }
        }
        
        // Military range check
        const militaryRange = MilitaryRanges.checkMilitary(hex);
        if (militaryRange) {
            enriched.military = true;
            enriched.militaryRange = militaryRange;
            if (!enriched.country) {
                enriched.country = militaryRange.replace('_MILITARY', '');
            }
        }
        
        // Intelligence assessment
        enriched.intelligence = this.generateIntelligenceAssessment(enriched);
        
        // Cache the enriched data
        this.aircraftCache.set(hex, {
            registration: enriched.registration,
            icaoType: enriched.icaoType,
            operator: enriched.operator,
            military: enriched.military,
            country: enriched.country,
            category: enriched.category,
            role: enriched.role,
            significance: enriched.significance,
            intelligence: enriched.intelligence,
            callsignInfo: enriched.callsignInfo,
            lastEnriched: Date.now()
        });
        
        return enriched;
    }

    /**
     * Look up aircraft in database
     */
    async lookupAircraft(hex) {
        // Check in-memory database first
        if (this.aircraftDB.has(hex)) {
            return this.aircraftDB.get(hex);
        }
        
        // Check IndexedDB
        try {
            const record = await this.storage.getAircraft(hex);
            if (record) {
                // Cache in memory
                this.aircraftDB.set(hex, record);
                return record;
            }
        } catch (error) {
            console.warn('Database lookup error:', error);
        }
        
        this.stats.unknownAircraft++;
        return null;
    }

    /**
     * Get aircraft type data
     */
    getAircraftTypeData(icaoType) {
        const type = icaoType.toLowerCase();
        
        // Check exact match first
        if (this.aircraftTypes.has(type)) {
            return this.aircraftTypes.get(type);
        }
        
        // Check partial matches for variants
        for (const [key, data] of this.aircraftTypes.entries()) {
            if (type.includes(key) || key.includes(type)) {
                return data;
            }
        }
        
        return null;
    }

    /**
     * Analyze callsign for military/operator information
     */
    analyzeCallsign(callsign) {
        if (!callsign || callsign.length < 3) return null;
        
        const clean = callsign.trim().toLowerCase();
        
        // Check known prefixes
        for (const [prefix, data] of this.operatorCache.entries()) {
            if (clean.startsWith(prefix)) {
                return {
                    prefix,
                    ...data,
                    confidence: 'high'
                };
            }
        }
        
        // Pattern analysis for common military formats
        const patterns = {
            // US Air Force patterns
            reach: /^rch\d+$/i,
            polo: /^polo\d+$/i,
            spar: /^spar\d+$/i,
            
            // Navy patterns
            sting: /^sting\d+$/i,
            
            // Special patterns
            blocked: /^blocked$/i,
            norad: /^norad\d+$/i
        };
        
        for (const [pattern, regex] of Object.entries(patterns)) {
            if (regex.test(clean)) {
                return {
                    pattern,
                    confidence: 'medium'
                };
            }
        }
        
        return null;
    }

    /**
     * Generate intelligence assessment
     */
    generateIntelligenceAssessment(aircraft) {
        const assessment = {
            significance: 1, // 1-5 scale
            missionType: 'unknown',
            notes: [],
            confidence: 'low'
        };
        
        // Aircraft type significance
        if (aircraft.significance) {
            assessment.significance = Math.max(assessment.significance, aircraft.significance);
        }
        
        // Emergency situations
        if (aircraft.emergency) {
            assessment.significance = 5;
            assessment.missionType = 'emergency';
            assessment.notes.push('Broadcasting emergency squawk code');
            assessment.confidence = 'high';
        }
        
        // Military aircraft assessment
        if (aircraft.military) {
            assessment.significance = Math.max(assessment.significance, 3);
            
            if (aircraft.category) {
                switch (aircraft.category) {
                    case 'fighter':
                        assessment.missionType = 'combat_air_patrol';
                        assessment.notes.push('Fighter aircraft - possible CAP or training mission');
                        break;
                    case 'bomber':
                        assessment.significance = 5;
                        assessment.missionType = 'strategic_mission';
                        assessment.notes.push('Strategic bomber - high significance mission');
                        break;
                    case 'surveillance':
                        assessment.significance = 5;
                        assessment.missionType = 'intelligence_gathering';
                        assessment.notes.push('Intelligence/surveillance aircraft - active mission');
                        break;
                    case 'tanker':
                        assessment.missionType = 'air_refueling';
                        assessment.notes.push('Aerial refueling - supporting other operations');
                        break;
                    case 'transport':
                        assessment.missionType = 'logistics';
                        assessment.notes.push('Military transport - logistics or personnel movement');
                        break;
                    case 'vip':
                        assessment.significance = 5;
                        assessment.missionType = 'vip_transport';
                        assessment.notes.push('VIP transport - high-value personnel');
                        break;
                }
            }
        }
        
        // Callsign analysis
        if (aircraft.callsignInfo) {
            assessment.confidence = aircraft.callsignInfo.confidence;
            
            if (aircraft.callsignInfo.type) {
                assessment.notes.push(`Callsign indicates: ${aircraft.callsignInfo.type}`);
            }
        }
        
        // Altitude analysis
        if (aircraft.altitude) {
            if (aircraft.altitude > 40000) {
                assessment.notes.push('High altitude flight - possible long-range mission');
            } else if (aircraft.altitude < 5000 && aircraft.groundSpeed > 200) {
                assessment.notes.push('Low altitude, high speed - possible tactical operation');
            }
        }
        
        // Speed analysis
        if (aircraft.groundSpeed) {
            if (aircraft.groundSpeed > 500 && aircraft.category === 'fighter') {
                assessment.notes.push('High speed fighter - possible intercept or urgent mission');
                assessment.significance = Math.max(assessment.significance, 4);
            }
        }
        
        return assessment;
    }

    /**
     * Search aircraft database
     */
    async searchAircraft(criteria) {
        const results = [];
        
        // Search in-memory database
        for (const [hex, aircraft] of this.aircraftDB.entries()) {
            let matches = true;
            
            if (criteria.registration && 
                !aircraft.registration?.toLowerCase().includes(criteria.registration.toLowerCase())) {
                matches = false;
            }
            
            if (criteria.operator && 
                !aircraft.operator?.toLowerCase().includes(criteria.operator.toLowerCase())) {
                matches = false;
            }
            
            if (criteria.icaoType && 
                !aircraft.icaoType?.toLowerCase().includes(criteria.icaoType.toLowerCase())) {
                matches = false;
            }
            
            if (criteria.military !== undefined && aircraft.military !== criteria.military) {
                matches = false;
            }
            
            if (criteria.country && aircraft.country !== criteria.country) {
                matches = false;
            }
            
            if (matches) {
                results.push(aircraft);
            }
        }
        
        // Also search IndexedDB if available
        if (this.storage) {
            try {
                const dbResults = await this.storage.searchAircraft(criteria);
                results.push(...dbResults);
            } catch (error) {
                console.warn('Database search error:', error);
            }
        }
        
        return results;
    }

    /**
     * Store aircraft data for future reference
     */
    async storeAircraft(aircraft) {
        if (!aircraft.hex) return;
        
        const hex = aircraft.hex.toLowerCase();
        const record = {
            hex,
            registration: aircraft.registration,
            icaoType: aircraft.icaoType,
            operator: aircraft.operator,
            military: aircraft.military,
            country: aircraft.country,
            lastSeen: Date.now()
        };
        
        // Store in memory
        this.aircraftDB.set(hex, record);
        
        // Store in IndexedDB
        if (this.storage) {
            try {
                await this.storage.storeAircraft(record);
            } catch (error) {
                console.warn('Could not store aircraft data:', error);
            }
        }
    }

    /**
     * Get service statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            databaseSize: this.aircraftDB.size,
            cacheSize: this.aircraftCache.size,
            aircraftTypes: this.aircraftTypes.size,
            operators: this.operatorCache.size,
            cacheHitRate: this.stats.enrichmentRequests > 0 ? 
                (this.stats.cacheHits / this.stats.enrichmentRequests * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Clear caches
     */
    clearCache() {
        this.aircraftCache.clear();
        console.log('🧹 Aircraft cache cleared');
    }

    /**
     * Export database for backup
     */
    async exportDatabase() {
        const data = {
            aircraftDB: Object.fromEntries(this.aircraftDB.entries()),
            aircraftTypes: Object.fromEntries(this.aircraftTypes.entries()),
            operators: Object.fromEntries(this.operatorCache.entries()),
            timestamp: Date.now(),
            version: '1.0'
        };
        
        return data;
    }

    /**
     * Import database from backup
     */
    async importDatabase(data) {
        if (!data || !data.aircraftDB) {
            throw new Error('Invalid database format');
        }
        
        // Clear existing data
        this.aircraftDB.clear();
        this.aircraftTypes.clear();
        this.operatorCache.clear();
        
        // Import data
        for (const [hex, record] of Object.entries(data.aircraftDB)) {
            this.aircraftDB.set(hex, record);
        }
        
        if (data.aircraftTypes) {
            for (const [type, record] of Object.entries(data.aircraftTypes)) {
                this.aircraftTypes.set(type, record);
            }
        }
        
        if (data.operators) {
            for (const [prefix, record] of Object.entries(data.operators)) {
                this.operatorCache.set(prefix, record);
            }
        }
        
        console.log('📥 Database imported successfully');
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.aircraftCache.clear();
        this.aircraftDB.clear();
        this.aircraftTypes.clear();
        this.operatorCache.clear();
        
        if (this.storage) {
            this.storage.close();
            this.storage = null;
        }
        
        console.log('✈️ Aircraft Database Service destroyed');
    }
}