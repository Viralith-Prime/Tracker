/**
 * Reactive State Management Store
 * 
 * Implements a centralized state store using JavaScript Proxy objects for 
 * automatic reactivity and unidirectional data flow, as specified in the blueprint.
 */

import { IndexedDBStorage } from '../utils/storage.js';

/**
 * Store class with Proxy-based reactivity
 * Provides centralized state management with automatic UI updates
 */
export class Store {
    constructor(initialState = {}) {
        this.state = {};
        this.subscribers = new Map();
        this.storage = new IndexedDBStorage('osint-tracker-store');
        this.mutations = new Map();
        this.history = [];
        this.maxHistoryLength = 100;
        
        // Initialize state with proxy wrapper
        this.initializeState(initialState);
        
        // Load persisted data
        this.loadPersistedState();
    }

    /**
     * Initialize state with Proxy wrapper for reactivity
     */
    initializeState(initialState) {
        // Create the reactive state proxy
        this.state = this.createReactiveProxy(initialState, '');
        
        console.log('📦 State store initialized with reactive proxy');
    }

    /**
     * Create a recursive Proxy for deep reactivity
     */
    createReactiveProxy(target, path = '') {
        // Handle Map objects specially
        if (target instanceof Map) {
            return this.createMapProxy(target, path);
        }
        
        // Handle arrays
        if (Array.isArray(target)) {
            return this.createArrayProxy(target, path);
        }
        
        // Handle objects
        if (target && typeof target === 'object') {
            return this.createObjectProxy(target, path);
        }
        
        // Return primitive values as-is
        return target;
    }

    /**
     * Create reactive proxy for Map objects
     */
    createMapProxy(map, path) {
        const reactiveMap = new Map();
        
        // Copy existing entries
        for (const [key, value] of map.entries()) {
            reactiveMap.set(key, this.createReactiveProxy(value, `${path}.${key}`));
        }
        
        // Wrap Map methods to trigger reactivity
        return new Proxy(reactiveMap, {
            get: (target, prop) => {
                const value = target[prop];
                
                // Intercept mutation methods
                if (prop === 'set') {
                    return (key, val) => {
                        const newPath = `${path}.${key}`;
                        const oldValue = target.get(key);
                        const reactiveValue = this.createReactiveProxy(val, newPath);
                        
                        target.set(key, reactiveValue);
                        this.notifySubscribers(newPath, reactiveValue, oldValue);
                        this.addToHistory('set', newPath, reactiveValue, oldValue);
                        
                        return target;
                    };
                }
                
                if (prop === 'delete') {
                    return (key) => {
                        const newPath = `${path}.${key}`;
                        const oldValue = target.get(key);
                        const result = target.delete(key);
                        
                        this.notifySubscribers(newPath, undefined, oldValue);
                        this.addToHistory('delete', newPath, undefined, oldValue);
                        
                        return result;
                    };
                }
                
                if (prop === 'clear') {
                    return () => {
                        const oldEntries = new Map(target);
                        target.clear();
                        
                        this.notifySubscribers(path, target, oldEntries);
                        this.addToHistory('clear', path, target, oldEntries);
                    };
                }
                
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });
    }

    /**
     * Create reactive proxy for Array objects
     */
    createArrayProxy(array, path) {
        const reactiveArray = array.map((item, index) => 
            this.createReactiveProxy(item, `${path}[${index}]`)
        );
        
        return new Proxy(reactiveArray, {
            set: (target, prop, value) => {
                const oldValue = target[prop];
                const newPath = `${path}[${prop}]`;
                
                if (prop === 'length' || !isNaN(prop)) {
                    target[prop] = this.createReactiveProxy(value, newPath);
                    this.notifySubscribers(newPath, target[prop], oldValue);
                    this.addToHistory('set', newPath, target[prop], oldValue);
                }
                
                return true;
            },
            
            get: (target, prop) => {
                const value = target[prop];
                
                // Intercept mutation methods
                if (typeof value === 'function') {
                    return (...args) => {
                        const oldArray = [...target];
                        const result = value.apply(target, args);
                        
                        if (['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].includes(prop)) {
                            this.notifySubscribers(path, target, oldArray);
                            this.addToHistory(prop, path, target, oldArray);
                        }
                        
                        return result;
                    };
                }
                
                return value;
            }
        });
    }

    /**
     * Create reactive proxy for regular objects
     */
    createObjectProxy(obj, path) {
        const reactiveObj = {};
        
        // Create reactive proxies for all properties
        for (const [key, value] of Object.entries(obj)) {
            reactiveObj[key] = this.createReactiveProxy(value, path ? `${path}.${key}` : key);
        }
        
        return new Proxy(reactiveObj, {
            set: (target, prop, value) => {
                const oldValue = target[prop];
                const newPath = path ? `${path}.${prop}` : prop;
                
                target[prop] = this.createReactiveProxy(value, newPath);
                
                this.notifySubscribers(newPath, target[prop], oldValue);
                this.addToHistory('set', newPath, target[prop], oldValue);
                
                return true;
            },
            
            get: (target, prop) => {
                return target[prop];
            },
            
            deleteProperty: (target, prop) => {
                const oldValue = target[prop];
                const newPath = path ? `${path}.${prop}` : prop;
                
                delete target[prop];
                
                this.notifySubscribers(newPath, undefined, oldValue);
                this.addToHistory('delete', newPath, undefined, oldValue);
                
                return true;
            }
        });
    }

    /**
     * Get the current state (non-reactive copy for external access)
     */
    getState() {
        return this.deepClone(this.state);
    }

    /**
     * Set state at a specific path
     */
    setState(path, value) {
        const keys = path.split('.');
        let current = this.state;
        
        // Navigate to the parent object
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current)) {
                current[key] = {};
            }
            current = current[key];
        }
        
        // Set the final value
        const finalKey = keys[keys.length - 1];
        current[finalKey] = value;
    }

    /**
     * Get state at a specific path
     */
    getStateAt(path) {
        const keys = path.split('.');
        let current = this.state;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        
        return this.deepClone(current);
    }

    /**
     * Subscribe to state changes
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }
        
        this.subscribers.get(path).add(callback);
        
        // Return unsubscribe function
        return () => {
            const pathSubscribers = this.subscribers.get(path);
            if (pathSubscribers) {
                pathSubscribers.delete(callback);
                if (pathSubscribers.size === 0) {
                    this.subscribers.delete(path);
                }
            }
        };
    }

    /**
     * Notify subscribers of state changes
     */
    notifySubscribers(path, newValue, oldValue) {
        // Notify exact path subscribers
        const exactSubscribers = this.subscribers.get(path);
        if (exactSubscribers) {
            exactSubscribers.forEach(callback => {
                try {
                    callback(path, this.deepClone(newValue), this.deepClone(oldValue));
                } catch (error) {
                    console.error('Error in state subscriber:', error);
                }
            });
        }
        
        // Notify wildcard subscribers
        const wildcardSubscribers = this.subscribers.get('*');
        if (wildcardSubscribers) {
            wildcardSubscribers.forEach(callback => {
                try {
                    callback(path, this.deepClone(newValue), this.deepClone(oldValue));
                } catch (error) {
                    console.error('Error in wildcard subscriber:', error);
                }
            });
        }
        
        // Notify parent path subscribers
        const pathParts = path.split('.');
        for (let i = pathParts.length - 1; i > 0; i--) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentSubscribers = this.subscribers.get(parentPath + '.*');
            
            if (parentSubscribers) {
                parentSubscribers.forEach(callback => {
                    try {
                        callback(path, this.deepClone(newValue), this.deepClone(oldValue));
                    } catch (error) {
                        console.error('Error in parent path subscriber:', error);
                    }
                });
            }
        }
    }

    /**
     * Register a mutation function
     */
    registerMutation(name, mutationFn) {
        this.mutations.set(name, mutationFn);
    }

    /**
     * Commit a mutation
     */
    commit(mutationName, payload) {
        const mutation = this.mutations.get(mutationName);
        if (mutation) {
            mutation(this.state, payload);
        } else {
            console.warn(`Mutation "${mutationName}" not found`);
        }
    }

    /**
     * Add state change to history for debugging/undo
     */
    addToHistory(action, path, newValue, oldValue) {
        this.history.push({
            timestamp: Date.now(),
            action,
            path,
            newValue: this.deepClone(newValue),
            oldValue: this.deepClone(oldValue)
        });
        
        // Limit history size
        if (this.history.length > this.maxHistoryLength) {
            this.history.shift();
        }
    }

    /**
     * Get state change history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clear state change history
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Persist specific paths to IndexedDB
     */
    async persistState(paths = ['user']) {
        try {
            for (const path of paths) {
                const data = this.getStateAt(path);
                if (data !== undefined) {
                    await this.storage.setItem(path, data);
                }
            }
        } catch (error) {
            console.error('Error persisting state:', error);
        }
    }

    /**
     * Load persisted state from IndexedDB
     */
    async loadPersistedState() {
        try {
            // Load user data
            const userData = await this.storage.getItem('user');
            if (userData) {
                this.setState('user', userData);
            }
            
            // Load other persisted data
            const geofences = await this.storage.getItem('geofences');
            if (geofences) {
                this.setState('user.geofences', geofences);
            }
            
            console.log('📂 Persisted state loaded from IndexedDB');
        } catch (error) {
            console.warn('Could not load persisted state:', error);
            
            // Fallback to localStorage
            try {
                const fallbackData = localStorage.getItem('osint-tracker-user-data');
                if (fallbackData) {
                    const userData = JSON.parse(fallbackData);
                    this.setState('user', { ...this.getStateAt('user'), ...userData });
                    console.log('📂 Fallback state loaded from localStorage');
                }
            } catch (fallbackError) {
                console.warn('Could not load fallback state:', fallbackError);
            }
        }
    }

    /**
     * Create a deep clone of an object (handles Maps, Arrays, Objects)
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Map) {
            const cloned = new Map();
            for (const [key, value] of obj.entries()) {
                cloned.set(key, this.deepClone(value));
            }
            return cloned;
        }
        
        if (obj instanceof Set) {
            const cloned = new Set();
            for (const value of obj.values()) {
                cloned.add(this.deepClone(value));
            }
            return cloned;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        const cloned = {};
        for (const [key, value] of Object.entries(obj)) {
            cloned[key] = this.deepClone(value);
        }
        
        return cloned;
    }

    /**
     * Get debugging information about the store
     */
    getDebugInfo() {
        return {
            subscriberCount: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
            historyLength: this.history.length,
            mutationCount: this.mutations.size,
            stateKeys: Object.keys(this.state)
        };
    }

    /**
     * Reset store to initial state
     */
    reset(newState = {}) {
        this.state = {};
        this.subscribers.clear();
        this.history = [];
        this.mutations.clear();
        
        this.initializeState(newState);
    }
}

// Export helper functions for actions and mutations
export const createAction = (type, payload) => ({ type, payload });

export const createMutation = (mutationFn) => {
    return (state, payload) => {
        try {
            mutationFn(state, payload);
        } catch (error) {
            console.error('Mutation error:', error);
            throw error;
        }
    };
};