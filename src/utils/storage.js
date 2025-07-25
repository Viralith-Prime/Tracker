/**
 * IndexedDB Storage Utility
 * 
 * Provides high-performance, asynchronous client-side storage using IndexedDB
 * as recommended in the blueprint for storing large amounts of data without
 * blocking the main thread.
 */

/**
 * IndexedDB wrapper for easy, high-performance storage
 */
export class IndexedDBStorage {
    constructor(dbName, version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    /**
     * Initialize the database
     */
    async initialize() {
        if (this.isInitialized) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error(`Failed to open database: ${request.error}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log(`📦 IndexedDB '${this.dbName}' initialized`);
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.setupDatabase(db, event.oldVersion, event.newVersion);
            };
        });

        return this.initPromise;
    }

    /**
     * Set up database schema
     */
    setupDatabase(db, oldVersion, newVersion) {
        console.log(`🔧 Upgrading database from version ${oldVersion} to ${newVersion}`);

        // Create object stores based on application needs
        
        // Key-value store for general data
        if (!db.objectStoreNames.contains('keyvalue')) {
            db.createObjectStore('keyvalue', { keyPath: 'key' });
        }

        // Aircraft database store
        if (!db.objectStoreNames.contains('aircraft')) {
            const aircraftStore = db.createObjectStore('aircraft', { keyPath: 'hex' });
            aircraftStore.createIndex('icaoType', 'icaoType', { unique: false });
            aircraftStore.createIndex('military', 'military', { unique: false });
            aircraftStore.createIndex('operator', 'operator', { unique: false });
        }

        // Flight tracks store
        if (!db.objectStoreNames.contains('tracks')) {
            const tracksStore = db.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
            tracksStore.createIndex('hex', 'hex', { unique: false });
            tracksStore.createIndex('timestamp', 'timestamp', { unique: false });
            tracksStore.createIndex('date', 'date', { unique: false });
        }

        // Geofences store
        if (!db.objectStoreNames.contains('geofences')) {
            const geofencesStore = db.createObjectStore('geofences', { keyPath: 'id' });
            geofencesStore.createIndex('name', 'name', { unique: false });
            geofencesStore.createIndex('created', 'created', { unique: false });
        }

        // User preferences store
        if (!db.objectStoreNames.contains('preferences')) {
            db.createObjectStore('preferences', { keyPath: 'key' });
        }

        // Historical data store for analytics
        if (!db.objectStoreNames.contains('analytics')) {
            const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
            analyticsStore.createIndex('type', 'type', { unique: false });
            analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
    }

    /**
     * Get item from key-value store
     */
    async getItem(key) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvalue'], 'readonly');
            const store = transaction.objectStore('keyvalue');
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };

            request.onerror = () => {
                reject(new Error(`Failed to get item: ${request.error}`));
            };
        });
    }

    /**
     * Set item in key-value store
     */
    async setItem(key, value) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvalue'], 'readwrite');
            const store = transaction.objectStore('keyvalue');
            const request = store.put({ key, value, timestamp: Date.now() });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to set item: ${request.error}`));
        });
    }

    /**
     * Remove item from key-value store
     */
    async removeItem(key) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['keyvalue'], 'readwrite');
            const store = transaction.objectStore('keyvalue');
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to remove item: ${request.error}`));
        });
    }

    /**
     * Store aircraft data
     */
    async storeAircraft(aircraft) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['aircraft'], 'readwrite');
            const store = transaction.objectStore('aircraft');
            const request = store.put({
                ...aircraft,
                lastUpdated: Date.now()
            });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to store aircraft: ${request.error}`));
        });
    }

    /**
     * Get aircraft by hex code
     */
    async getAircraft(hex) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['aircraft'], 'readonly');
            const store = transaction.objectStore('aircraft');
            const request = store.get(hex);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error(`Failed to get aircraft: ${request.error}`));
        });
    }

    /**
     * Search aircraft by criteria
     */
    async searchAircraft(criteria) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['aircraft'], 'readonly');
            const store = transaction.objectStore('aircraft');
            const results = [];

            let request;
            if (criteria.military !== undefined) {
                const index = store.index('military');
                request = index.openCursor(IDBKeyRange.only(criteria.military));
            } else if (criteria.icaoType) {
                const index = store.index('icaoType');
                request = index.openCursor(IDBKeyRange.only(criteria.icaoType));
            } else if (criteria.operator) {
                const index = store.index('operator');
                request = index.openCursor(IDBKeyRange.only(criteria.operator));
            } else {
                request = store.openCursor();
            }

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const aircraft = cursor.value;
                    
                    // Apply additional filters
                    let matches = true;
                    if (criteria.registration && !aircraft.registration?.includes(criteria.registration)) {
                        matches = false;
                    }
                    if (criteria.callsign && !aircraft.callsign?.includes(criteria.callsign)) {
                        matches = false;
                    }
                    
                    if (matches) {
                        results.push(aircraft);
                    }
                    
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(new Error(`Failed to search aircraft: ${request.error}`));
        });
    }

    /**
     * Store flight track data
     */
    async storeTrack(trackData) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readwrite');
            const store = transaction.objectStore('tracks');
            
            const data = {
                ...trackData,
                timestamp: Date.now(),
                date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
            };
            
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to store track: ${request.error}`));
        });
    }

    /**
     * Get flight tracks for aircraft
     */
    async getTracks(hex, startDate, endDate) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['tracks'], 'readonly');
            const store = transaction.objectStore('tracks');
            const index = store.index('hex');
            const results = [];
            
            const request = index.openCursor(IDBKeyRange.only(hex));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const track = cursor.value;
                    
                    // Filter by date range if provided
                    if (startDate && endDate) {
                        const trackDate = new Date(track.timestamp);
                        if (trackDate >= startDate && trackDate <= endDate) {
                            results.push(track);
                        }
                    } else {
                        results.push(track);
                    }
                    
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(new Error(`Failed to get tracks: ${request.error}`));
        });
    }

    /**
     * Store geofence data
     */
    async storeGeofence(geofence) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geofences'], 'readwrite');
            const store = transaction.objectStore('geofences');
            
            const data = {
                ...geofence,
                created: geofence.created || Date.now(),
                lastModified: Date.now()
            };
            
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to store geofence: ${request.error}`));
        });
    }

    /**
     * Get all geofences
     */
    async getGeofences() {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geofences'], 'readonly');
            const store = transaction.objectStore('geofences');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to get geofences: ${request.error}`));
        });
    }

    /**
     * Delete geofence
     */
    async deleteGeofence(id) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geofences'], 'readwrite');
            const store = transaction.objectStore('geofences');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to delete geofence: ${request.error}`));
        });
    }

    /**
     * Store analytics data
     */
    async storeAnalytics(type, data) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readwrite');
            const store = transaction.objectStore('analytics');
            
            const record = {
                type,
                data,
                timestamp: Date.now()
            };
            
            const request = store.add(record);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to store analytics: ${request.error}`));
        });
    }

    /**
     * Get analytics data by type and date range
     */
    async getAnalytics(type, startDate, endDate) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const typeIndex = store.index('type');
            const results = [];
            
            const request = typeIndex.openCursor(IDBKeyRange.only(type));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    
                    if (startDate && endDate) {
                        if (record.timestamp >= startDate.getTime() && record.timestamp <= endDate.getTime()) {
                            results.push(record);
                        }
                    } else {
                        results.push(record);
                    }
                    
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(new Error(`Failed to get analytics: ${request.error}`));
        });
    }

    /**
     * Bulk operation for better performance
     */
    async bulkOperation(storeName, operations) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const results = [];
            let completed = 0;

            const handleComplete = () => {
                completed++;
                if (completed === operations.length) {
                    resolve(results);
                }
            };

            transaction.onerror = () => reject(new Error(`Bulk operation failed: ${transaction.error}`));

            operations.forEach((operation, index) => {
                let request;
                
                switch (operation.type) {
                    case 'put':
                        request = store.put(operation.data);
                        break;
                    case 'add':
                        request = store.add(operation.data);
                        break;
                    case 'delete':
                        request = store.delete(operation.key);
                        break;
                    case 'get':
                        request = store.get(operation.key);
                        break;
                    default:
                        throw new Error(`Unknown operation type: ${operation.type}`);
                }

                request.onsuccess = () => {
                    results[index] = request.result;
                    handleComplete();
                };

                request.onerror = () => {
                    results[index] = { error: request.error };
                    handleComplete();
                };
            });
        });
    }

    /**
     * Clear all data from a store
     */
    async clearStore(storeName) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to clear store: ${request.error}`));
        });
    }

    /**
     * Get database storage usage
     */
    async getStorageUsage() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return null;
        }

        try {
            const estimate = await navigator.storage.estimate();
            return {
                quota: estimate.quota,
                usage: estimate.usage,
                available: estimate.quota - estimate.usage,
                usageDetails: estimate.usageDetails
            };
        } catch (error) {
            console.warn('Could not get storage usage:', error);
            return null;
        }
    }

    /**
     * Compact database by removing old data
     */
    async compact(retentionDays = 30) {
        await this.initialize();
        
        const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        
        // Clean up old tracks
        await this.deleteOldRecords('tracks', 'timestamp', cutoffDate);
        
        // Clean up old analytics
        await this.deleteOldRecords('analytics', 'timestamp', cutoffDate);
        
        console.log(`🧹 Database compacted, removed data older than ${retentionDays} days`);
    }

    /**
     * Delete old records from a store
     */
    async deleteOldRecords(storeName, indexName, cutoffTimestamp) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            
            const range = IDBKeyRange.upperBound(cutoffTimestamp);
            const request = index.openCursor(range);
            let deletedCount = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    deletedCount++;
                    cursor.continue();
                } else {
                    console.log(`Deleted ${deletedCount} old records from ${storeName}`);
                    resolve(deletedCount);
                }
            };

            request.onerror = () => reject(new Error(`Failed to delete old records: ${request.error}`));
        });
    }

    /**
     * Export data for backup
     */
    async exportData(storeNames = ['keyvalue', 'geofences', 'preferences']) {
        await this.initialize();
        
        const exportData = {};
        
        for (const storeName of storeNames) {
            exportData[storeName] = await this.getAllFromStore(storeName);
        }
        
        return {
            version: this.version,
            timestamp: Date.now(),
            data: exportData
        };
    }

    /**
     * Import data from backup
     */
    async importData(backupData) {
        await this.initialize();
        
        const operations = [];
        
        for (const [storeName, records] of Object.entries(backupData.data)) {
            for (const record of records) {
                operations.push({
                    storeName,
                    type: 'put',
                    data: record
                });
            }
        }
        
        // Process in batches to avoid transaction timeout
        const batchSize = 100;
        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = operations.slice(i, i + batchSize);
            const storeNames = [...new Set(batch.map(op => op.storeName))];
            
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(storeNames, 'readwrite');
                
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
                
                batch.forEach(operation => {
                    const store = transaction.objectStore(operation.storeName);
                    store.put(operation.data);
                });
            });
        }
        
        console.log(`📥 Imported ${operations.length} records from backup`);
    }

    /**
     * Get all records from a store
     */
    async getAllFromStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to get all from ${storeName}: ${request.error}`));
        });
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isInitialized = false;
            console.log(`📦 IndexedDB '${this.dbName}' closed`);
        }
    }
}

/**
 * Simple localStorage wrapper for fallback scenarios
 */
export class LocalStorageWrapper {
    constructor(prefix = 'osint-tracker-') {
        this.prefix = prefix;
        this.isAvailable = this.checkAvailability();
    }

    checkAvailability() {
        try {
            const testKey = '__test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('localStorage not available:', error);
            return false;
        }
    }

    async getItem(key) {
        if (!this.isAvailable) return null;
        
        try {
            const data = localStorage.getItem(this.prefix + key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Error getting localStorage item:', error);
            return null;
        }
    }

    async setItem(key, value) {
        if (!this.isAvailable) return;
        
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch (error) {
            console.warn('Error setting localStorage item:', error);
            throw error;
        }
    }

    async removeItem(key) {
        if (!this.isAvailable) return;
        
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (error) {
            console.warn('Error removing localStorage item:', error);
        }
    }

    async clear() {
        if (!this.isAvailable) return;
        
        const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
        keys.forEach(key => localStorage.removeItem(key));
    }
}

/**
 * Storage factory that chooses the best available storage method
 */
export class StorageFactory {
    static async create(name) {
        try {
            // Try IndexedDB first
            const idbStorage = new IndexedDBStorage(name);
            await idbStorage.initialize();
            console.log('✅ Using IndexedDB for storage');
            return idbStorage;
        } catch (error) {
            console.warn('IndexedDB not available, falling back to localStorage:', error);
            // Fallback to localStorage
            return new LocalStorageWrapper(name + '-');
        }
    }
}