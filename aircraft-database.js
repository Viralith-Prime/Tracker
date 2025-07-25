/**
 * Military Aircraft Database and OSINT Enrichment Module
 * Provides aircraft identification, categorization, and intelligence enhancement
 * Based on publicly available military aircraft data
 */

class AircraftDatabase {
    constructor() {
        this.militaryTypes = this.initializeMilitaryTypes();
        this.categories = this.initializeCategories();
        this.callsignPrefixes = this.initializeCallsignPrefixes();
        this.countries = this.initializeCountries();
    }

    /**
     * Initialize military aircraft types database
     */
    initializeMilitaryTypes() {
        return {
            // Fighters and Attack Aircraft
            'F16': { name: 'F-16 Fighting Falcon', category: 'fighter', role: 'Multirole Fighter' },
            'F15': { name: 'F-15 Eagle', category: 'fighter', role: 'Air Superiority Fighter' },
            'F22': { name: 'F-22 Raptor', category: 'fighter', role: 'Stealth Fighter' },
            'F35': { name: 'F-35 Lightning II', category: 'fighter', role: 'Stealth Multirole Fighter' },
            'F18': { name: 'F/A-18 Hornet/Super Hornet', category: 'fighter', role: 'Multirole Fighter' },
            'A10': { name: 'A-10 Thunderbolt II', category: 'fighter', role: 'Close Air Support' },
            'AV8B': { name: 'AV-8B Harrier II', category: 'fighter', role: 'VTOL Attack Aircraft' },
            'F4': { name: 'F-4 Phantom II', category: 'fighter', role: 'Multirole Fighter (Legacy)' },
            'EUFI': { name: 'Eurofighter Typhoon', category: 'fighter', role: 'Multirole Fighter' },
            'GRIN': { name: 'JAS 39 Gripen', category: 'fighter', role: 'Multirole Fighter' },
            'RFAL': { name: 'Dassault Rafale', category: 'fighter', role: 'Multirole Fighter' },

            // Transport Aircraft
            'C130': { name: 'C-130 Hercules', category: 'transport', role: 'Tactical Transport' },
            'C17': { name: 'C-17 Globemaster III', category: 'transport', role: 'Strategic Transport' },
            'C5': { name: 'C-5 Galaxy', category: 'transport', role: 'Heavy Strategic Transport' },
            'C141': { name: 'C-141 Starlifter', category: 'transport', role: 'Strategic Transport' },
            'A400M': { name: 'Airbus A400M Atlas', category: 'transport', role: 'Tactical Transport' },
            'AN124': { name: 'Antonov An-124', category: 'transport', role: 'Heavy Strategic Transport' },
            'IL76': { name: 'Ilyushin Il-76', category: 'transport', role: 'Strategic Transport' },
            'C160': { name: 'Transall C-160', category: 'transport', role: 'Tactical Transport' },

            // Tanker Aircraft
            'KC135': { name: 'KC-135 Stratotanker', category: 'tanker', role: 'Aerial Refueling' },
            'KC10': { name: 'KC-10 Extender', category: 'tanker', role: 'Aerial Refueling/Transport' },
            'KC46': { name: 'KC-46 Pegasus', category: 'tanker', role: 'Aerial Refueling' },
            'A330': { name: 'A330 MRTT', category: 'tanker', role: 'Multi-Role Tanker Transport' },
            'KC767': { name: 'KC-767', category: 'tanker', role: 'Aerial Refueling' },

            // Surveillance and Electronic Warfare
            'E3': { name: 'E-3 Sentry (AWACS)', category: 'surveillance', role: 'Airborne Early Warning' },
            'E2': { name: 'E-2 Hawkeye', category: 'surveillance', role: 'Carrier-based AEW' },
            'RC135': { name: 'RC-135 Rivet Joint', category: 'surveillance', role: 'Electronic Intelligence' },
            'U2': { name: 'U-2 Dragon Lady', category: 'surveillance', role: 'High-altitude Reconnaissance' },
            'RQ4': { name: 'RQ-4 Global Hawk', category: 'surveillance', role: 'High-altitude Drone' },
            'MQ9': { name: 'MQ-9 Reaper', category: 'surveillance', role: 'Armed Reconnaissance Drone' },
            'P8': { name: 'P-8 Poseidon', category: 'surveillance', role: 'Maritime Patrol' },
            'P3': { name: 'P-3 Orion', category: 'surveillance', role: 'Maritime Patrol' },
            'EP3': { name: 'EP-3 Aries', category: 'surveillance', role: 'Electronic Surveillance' },
            'EA18G': { name: 'EA-18G Growler', category: 'surveillance', role: 'Electronic Warfare' },

            // Training Aircraft
            'T38': { name: 'T-38 Talon', category: 'trainer', role: 'Advanced Trainer' },
            'T6': { name: 'T-6 Texan II', category: 'trainer', role: 'Primary Trainer' },
            'T45': { name: 'T-45 Goshawk', category: 'trainer', role: 'Carrier Training' },
            'BAE146': { name: 'BAe Hawk', category: 'trainer', role: 'Advanced Trainer' },

            // Special Operations
            'AC130': { name: 'AC-130 Gunship', category: 'special', role: 'Ground Attack Gunship' },
            'MC130': { name: 'MC-130 Combat Talon', category: 'special', role: 'Special Operations Transport' },
            'CV22': { name: 'CV-22 Osprey', category: 'special', role: 'Special Operations Tiltrotor' },

            // VIP/Command Aircraft
            'VC25': { name: 'VC-25 (Air Force One)', category: 'vip', role: 'Presidential Transport' },
            'C32': { name: 'C-32', category: 'vip', role: 'VIP Transport' },
            'C40': { name: 'C-40 Clipper', category: 'vip', role: 'VIP/Executive Transport' },
            'E4': { name: 'E-4B Nightwatch', category: 'vip', role: 'Airborne Command Post' },

            // Helicopters
            'UH60': { name: 'UH-60 Black Hawk', category: 'helicopter', role: 'Utility Helicopter' },
            'CH47': { name: 'CH-47 Chinook', category: 'helicopter', role: 'Heavy-lift Helicopter' },
            'AH64': { name: 'AH-64 Apache', category: 'helicopter', role: 'Attack Helicopter' },
            'UH1': { name: 'UH-1 Huey', category: 'helicopter', role: 'Utility Helicopter' },
            'CH53': { name: 'CH-53 Sea Stallion', category: 'helicopter', role: 'Heavy-lift Helicopter' },
            'AH1': { name: 'AH-1 Cobra', category: 'helicopter', role: 'Attack Helicopter' },

            // Bombers
            'B52': { name: 'B-52 Stratofortress', category: 'bomber', role: 'Strategic Bomber' },
            'B1': { name: 'B-1 Lancer', category: 'bomber', role: 'Strategic Bomber' },
            'B2': { name: 'B-2 Spirit', category: 'bomber', role: 'Stealth Strategic Bomber' }
        };
    }

    /**
     * Initialize aircraft categories for filtering
     */
    initializeCategories() {
        return {
            fighter: { icon: '✈️', color: '#e74c3c', priority: 1 },
            bomber: { icon: '🛩️', color: '#c0392b', priority: 1 },
            transport: { icon: '🛫', color: '#3498db', priority: 3 },
            tanker: { icon: '⛽', color: '#f39c12', priority: 2 },
            surveillance: { icon: '📡', color: '#9b59b6', priority: 2 },
            trainer: { icon: '🎓', color: '#95a5a6', priority: 4 },
            helicopter: { icon: '🚁', color: '#2ecc71', priority: 3 },
            special: { icon: '⚡', color: '#e67e22', priority: 1 },
            vip: { icon: '👑', color: '#f1c40f', priority: 1 },
            unknown: { icon: '❓', color: '#7f8c8d', priority: 5 }
        };
    }

    /**
     * Initialize military callsign prefixes for country identification
     */
    initializeCallsignPrefixes() {
        return {
            // United States
            'RCH': { country: 'US', branch: 'Air Force', type: 'Reach (Transport)' },
            'EVAC': { country: 'US', branch: 'Air Force', type: 'Medical Evacuation' },
            'SPAR': { country: 'US', branch: 'Air Force', type: 'Special Air Mission' },
            'POLO': { country: 'US', branch: 'Air Force', type: 'KC-135 Tanker' },
            'QUID': { country: 'US', branch: 'Air Force', type: 'KC-10 Tanker' },
            'GRIM': { country: 'US', branch: 'Air Force', type: 'A-10 Attack' },
            'BONE': { country: 'US', branch: 'Air Force', type: 'B-1 Bomber' },
            'BUFF': { country: 'US', branch: 'Air Force', type: 'B-52 Bomber' },
            'DARK': { country: 'US', branch: 'Air Force', type: 'Special Operations' },
            'KNIFE': { country: 'US', branch: 'Army', type: 'Special Operations' },
            'VADER': { country: 'US', branch: 'Air Force', type: 'F-16 Fighter' },
            'VIPER': { country: 'US', branch: 'Air Force', type: 'F-16 Fighter' },
            'EAGLE': { country: 'US', branch: 'Air Force', type: 'F-15 Fighter' },
            'RAPTOR': { country: 'US', branch: 'Air Force', type: 'F-22 Fighter' },

            // NATO
            'NATO': { country: 'NATO', branch: 'NATO', type: 'NATO Aircraft' },
            'AWACS': { country: 'NATO', branch: 'NATO', type: 'E-3 AWACS' },

            // United Kingdom
            'RRR': { country: 'UK', branch: 'RAF', type: 'Royal Air Force' },
            'ASCOT': { country: 'UK', branch: 'RAF', type: 'Transport' },
            'RAFAIR': { country: 'UK', branch: 'RAF', type: 'Air-to-Air Refueling' },

            // Germany
            'GAF': { country: 'DE', branch: 'Luftwaffe', type: 'German Air Force' },
            'GERMAN': { country: 'DE', branch: 'Luftwaffe', type: 'German Air Force' },

            // France
            'COTAM': { country: 'FR', branch: 'Armée de l\'Air', type: 'French Air Force Transport' },
            'FAF': { country: 'FR', branch: 'Armée de l\'Air', type: 'French Air Force' },

            // Canada
            'CFC': { country: 'CA', branch: 'RCAF', type: 'Canadian Forces' },
            'CANFORCE': { country: 'CA', branch: 'RCAF', type: 'Canadian Forces' },

            // Australia
            'RAAF': { country: 'AU', branch: 'RAAF', type: 'Royal Australian Air Force' },
            'AUSSIE': { country: 'AU', branch: 'RAAF', type: 'Royal Australian Air Force' }
        };
    }

    /**
     * Initialize country codes and names
     */
    initializeCountries() {
        return {
            'US': { name: 'United States', flag: '🇺🇸' },
            'UK': { name: 'United Kingdom', flag: '🇬🇧' },
            'DE': { name: 'Germany', flag: '🇩🇪' },
            'FR': { name: 'France', flag: '🇫🇷' },
            'CA': { name: 'Canada', flag: '🇨🇦' },
            'AU': { name: 'Australia', flag: '🇦🇺' },
            'NATO': { name: 'NATO', flag: '🏛️' }
        };
    }

    /**
     * Enrich aircraft data with OSINT information
     */
    enrichAircraft(aircraft) {
        const enriched = { ...aircraft };
        
        // Identify aircraft type and category
        const typeInfo = this.identifyAircraftType(aircraft.t || aircraft.type);
        if (typeInfo) {
            enriched.aircraftName = typeInfo.name;
            enriched.category = typeInfo.category;
            enriched.role = typeInfo.role;
            enriched.categoryInfo = this.categories[typeInfo.category] || this.categories.unknown;
        } else {
            enriched.category = 'unknown';
            enriched.categoryInfo = this.categories.unknown;
        }

        // Analyze callsign for country and unit information
        const callsignInfo = this.analyzeCallsign(aircraft.flight || aircraft.callsign);
        if (callsignInfo) {
            enriched.country = callsignInfo.country;
            enriched.branch = callsignInfo.branch;
            enriched.callsignType = callsignInfo.type;
            enriched.countryInfo = this.countries[callsignInfo.country];
        }

        // Generate unique identifier for tracking
        enriched.id = aircraft.hex || aircraft.icao;
        
        // Calculate derived information
        enriched.speed = aircraft.gs || aircraft.ground_speed || 0;
        enriched.altitude = aircraft.alt_baro || aircraft.altitude || 0;
        enriched.heading = aircraft.track || aircraft.heading || 0;
        
        // Add timestamp
        enriched.lastSeen = Date.now();
        enriched.lastUpdate = new Date().toISOString();

        // Generate intelligence assessment
        enriched.intelligence = this.generateIntelligenceAssessment(enriched);

        return enriched;
    }

    /**
     * Identify aircraft type from ICAO type code
     */
    identifyAircraftType(typeCode) {
        if (!typeCode) return null;
        
        const normalizedType = typeCode.toUpperCase();
        
        // Direct match
        if (this.militaryTypes[normalizedType]) {
            return this.militaryTypes[normalizedType];
        }

        // Fuzzy matching for variations
        for (const [key, value] of Object.entries(this.militaryTypes)) {
            if (normalizedType.includes(key) || key.includes(normalizedType)) {
                return value;
            }
        }

        return null;
    }

    /**
     * Analyze callsign for operational intelligence
     */
    analyzeCallsign(callsign) {
        if (!callsign) return null;

        const normalizedCallsign = callsign.toUpperCase().trim();

        // Check for known prefixes
        for (const [prefix, info] of Object.entries(this.callsignPrefixes)) {
            if (normalizedCallsign.startsWith(prefix)) {
                return info;
            }
        }

        // Pattern analysis for numeric callsigns
        if (/^[A-Z]{3,4}\d{2,4}$/.test(normalizedCallsign)) {
            return { country: 'US', branch: 'Military', type: 'Tactical Callsign' };
        }

        return null;
    }

    /**
     * Generate intelligence assessment based on aircraft data
     */
    generateIntelligenceAssessment(aircraft) {
        const assessment = {
            threatLevel: 'Unknown',
            operationalStatus: 'Unknown',
            missionType: 'Unknown',
            significance: 1,
            notes: []
        };

        // Assess based on aircraft category
        switch (aircraft.category) {
            case 'fighter':
            case 'bomber':
                assessment.threatLevel = 'High';
                assessment.significance = 5;
                assessment.notes.push('Combat aircraft - high strategic value');
                break;
            case 'surveillance':
                assessment.threatLevel = 'Medium';
                assessment.significance = 4;
                assessment.notes.push('Intelligence gathering capability');
                break;
            case 'tanker':
                assessment.significance = 4;
                assessment.notes.push('Force multiplier - indicates nearby operations');
                break;
            case 'transport':
                assessment.significance = 3;
                assessment.notes.push('Logistics and personnel movement');
                break;
            case 'vip':
                assessment.significance = 5;
                assessment.notes.push('High-value personnel transport');
                break;
        }

        // Assess operational patterns
        if (aircraft.altitude > 40000) {
            assessment.notes.push('High-altitude operation');
        }
        
        if (aircraft.speed > 500) {
            assessment.notes.push('High-speed transit');
            assessment.operationalStatus = 'Active Mission';
        }

        // Geographic assessment (placeholder for future enhancement)
        assessment.missionType = this.assessMissionType(aircraft);

        return assessment;
    }

    /**
     * Assess likely mission type based on patterns
     */
    assessMissionType(aircraft) {
        // This is a simplified assessment - real implementation would be more sophisticated
        if (aircraft.category === 'tanker') {
            return 'Air-to-Air Refueling';
        } else if (aircraft.category === 'transport') {
            return 'Logistics/Personnel Transport';
        } else if (aircraft.category === 'surveillance') {
            return 'Intelligence/Surveillance/Reconnaissance';
        } else if (aircraft.category === 'fighter') {
            return 'Combat Air Patrol/Training';
        }
        
        return 'Unknown';
    }

    /**
     * Get aircraft icon based on category
     */
    getAircraftIcon(category) {
        return this.categories[category]?.icon || this.categories.unknown.icon;
    }

    /**
     * Get aircraft color based on category
     */
    getAircraftColor(category) {
        return this.categories[category]?.color || this.categories.unknown.color;
    }

    /**
     * Filter aircraft by category
     */
    filterByCategory(aircraftList, enabledCategories) {
        return aircraftList.filter(aircraft => 
            enabledCategories.includes(aircraft.category)
        );
    }

    /**
     * Generate ICAO to N-Number conversion (US aircraft)
     */
    icaoToNNumber(icaoHex) {
        if (!icaoHex) return null;
        
        const hex = icaoHex.toUpperCase().replace(/^0+/, '');
        const decimal = parseInt(hex, 16);
        
        // US aircraft range: A00001 to AFFFFF
        if (decimal >= 0xA00001 && decimal <= 0xAFFFFF) {
            const offset = decimal - 0xA00001;
            const nNumber = 'N' + (offset + 1).toString().padStart(5, '0');
            return nNumber;
        }
        
        return null;
    }

    /**
     * Generate external research links for aircraft
     */
    generateResearchLinks(aircraft) {
        const links = {};
        
        if (aircraft.hex) {
            links.flightRadar24 = `https://www.flightradar24.com/data/aircraft/${aircraft.hex}`;
            links.adsbExchange = `https://globe.adsbexchange.com/?icao=${aircraft.hex}`;
            links.planeFinder = `https://planefinder.net/data/aircraft/${aircraft.hex}`;
        }
        
        if (aircraft.flight) {
            links.flightAware = `https://flightaware.com/live/flight/${aircraft.flight}`;
        }
        
        const nNumber = this.icaoToNNumber(aircraft.hex);
        if (nNumber) {
            links.registry = `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?nNumberTxt=${nNumber}`;
            links.jetPhotos = `https://www.jetphotos.com/registration/${nNumber}`;
            links.planeSpotters = `https://www.planespotters.net/search?q=${nNumber}`;
        }
        
        return links;
    }
}

// Export for use in main application
window.AircraftDatabase = AircraftDatabase;