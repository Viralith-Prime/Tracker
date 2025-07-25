/**
 * Alert System Component
 * 
 * Provides proactive alerting with debouncing, rate limiting, and 
 * notification mechanisms as specified in the blueprint.
 */

import { DOMOptimizer } from '../utils/performance.js';
import { debounce } from '../utils/performance.js';

/**
 * AlertSystem component class
 * Manages alerts, notifications, and event monitoring
 */
export class AlertSystem {
    constructor(options = {}) {
        this.store = options.store;
        this.container = null;
        this.isInitialized = false;
        
        // Alert management
        this.alerts = new Map();
        this.alertHistory = [];
        this.maxHistorySize = 1000;
        
        // Rate limiting and debouncing
        this.alertCooldowns = new Map(); // Prevent spam alerts
        this.alertCounters = new Map(); // Track alert frequency
        this.cooldownDuration = 5 * 60 * 1000; // 5 minutes
        
        // Notification permissions
        this.notificationPermission = 'default';
        
        // Debounced functions
        this.debouncedUpdateUI = debounce(this.updateUI.bind(this), 500);
        
        console.log('🚨 Alert System initialized');
    }

    /**
     * Initialize the component
     */
    async initialize() {
        try {
            // Find the container
            this.container = document.querySelector('#alerts-container');
            if (!this.container) {
                throw new Error('Alerts container not found');
            }
            
            // Request notification permissions
            await this.requestNotificationPermission();
            
            // Subscribe to store changes
            this.subscribeToStore();
            
            // Set up alert triggers
            this.setupAlertTriggers();
            
            // Initial render
            await this.render();
            
            this.isInitialized = true;
            console.log('✅ Alert System initialized successfully');
            
        } catch (error) {
            console.error('❌ Alert System initialization failed:', error);
            throw error;
        }
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if ('Notification' in window) {
            this.notificationPermission = await Notification.requestPermission();
            console.log(`🔔 Notification permission: ${this.notificationPermission}`);
        } else {
            console.warn('Notifications not supported in this browser');
        }
    }

    /**
     * Subscribe to store changes
     */
    subscribeToStore() {
        if (!this.store) return;
        
        // Subscribe to aircraft data for emergency detection
        this.store.subscribe('live.aircraft', (path, aircraftMap) => {
            this.checkEmergencyAircraft(aircraftMap);
        });
        
        // Subscribe to watchlist changes for appearance alerts
        this.store.subscribe('user.watchlist', (path, watchlist) => {
            this.checkWatchlistAppearances(watchlist);
        });
        
        // Subscribe to connection status for system alerts
        this.store.subscribe('live.connectionStatus', (path, status) => {
            this.checkConnectionStatus(status);
        });
    }

    /**
     * Set up alert triggers
     */
    setupAlertTriggers() {
        // Emergency squawk codes monitoring
        this.emergencySquawks = new Set(['7500', '7600', '7700']);
        
        // Military ICAO ranges for high-value target detection
        this.militaryRanges = [
            { start: 0xAE0000, end: 0xAEFFFF, country: 'USA' },
            { start: 0x400000, end: 0x43FFFF, country: 'UK' },
            { start: 0x3C0000, end: 0x3FFFFF, country: 'Germany' },
            { start: 0x390000, end: 0x3BFFFF, country: 'France' }
        ];
    }

    /**
     * Render the alerts list
     */
    async render() {
        const alerts = Array.from(this.alerts.values()).sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        if (alerts.length === 0) {
            this.renderEmptyState();
            return;
        }
        
        await this.renderAlertsList(alerts);
    }

    /**
     * Render empty alerts state
     */
    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔔</div>
                <h4>No Active Alerts</h4>
                <p>The system is monitoring for emergency situations, watchlist appearances, and geofence events.</p>
                <div class="alert-settings">
                    <button class="btn btn-outline" id="test-alert">
                        <i class="icon-bell"></i>
                        Test Alert
                    </button>
                    <button class="btn btn-outline" id="clear-history">
                        <i class="icon-trash"></i>
                        Clear History
                    </button>
                </div>
            </div>
        `;
        
        // Bind test alert button
        const testBtn = this.container.querySelector('#test-alert');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.createTestAlert());
        }
        
        // Bind clear history button
        const clearBtn = this.container.querySelector('#clear-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAlertHistory());
        }
    }

    /**
     * Render alerts list
     */
    async renderAlertsList(alerts) {
        const template = document.getElementById('alert-item-template');
        if (!template) {
            console.error('Alert item template not found');
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        // Add clear all button at the top
        const clearButton = document.createElement('div');
        clearButton.className = 'alert-actions';
        clearButton.innerHTML = `
            <button class="btn btn-outline btn-block" id="clear-all-alerts">
                <i class="icon-trash"></i>
                Clear All Alerts
            </button>
        `;
        fragment.appendChild(clearButton);
        
        // Render alert items
        for (const alert of alerts.slice(0, 50)) { // Limit to 50 most recent
            const item = this.createAlertItem(template, alert);
            fragment.appendChild(item);
        }
        
        await DOMOptimizer.replaceContent(this.container, fragment);
        
        // Bind clear all button
        const clearAllBtn = this.container.querySelector('#clear-all-alerts');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllAlerts());
        }
    }

    /**
     * Create an alert item element
     */
    createAlertItem(template, alert) {
        const item = template.content.cloneNode(true);
        const container = item.querySelector('.alert-item');
        
        if (!container) return item;
        
        // Set alert severity class
        container.className = `alert-item severity-${alert.severity}`;
        container.dataset.id = alert.id;
        
        // Alert icon
        const icon = item.querySelector('.alert-icon');
        if (icon) {
            icon.textContent = this.getAlertIcon(alert.type, alert.severity);
        }
        
        // Alert title
        const title = item.querySelector('.alert-title');
        if (title) {
            title.textContent = alert.title;
        }
        
        // Alert message
        const message = item.querySelector('.alert-message');
        if (message) {
            message.textContent = alert.message;
        }
        
        // Alert timestamp
        const timestamp = item.querySelector('.alert-timestamp');
        if (timestamp) {
            timestamp.textContent = this.formatTimestamp(alert.timestamp);
        }
        
        // Bind event listeners
        this.bindAlertItemEvents(container, alert);
        
        return item;
    }

    /**
     * Bind event listeners to alert item
     */
    bindAlertItemEvents(container, alert) {
        // Click to view details or take action
        container.addEventListener('click', () => {
            this.handleAlertClick(alert);
        });
        
        // Dismiss button
        const dismissBtn = container.querySelector('.dismiss-btn');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.dismissAlert(alert.id);
            });
        }
    }

    /**
     * Check for emergency aircraft (7500, 7600, 7700 squawks)
     */
    checkEmergencyAircraft(aircraftMap) {
        if (!aircraftMap) return;
        
        for (const [hex, aircraft] of aircraftMap.entries()) {
            if (aircraft.squawk && this.emergencySquawks.has(aircraft.squawk)) {
                const alertKey = `emergency-${hex}-${aircraft.squawk}`;
                
                if (!this.isAlertCooledDown(alertKey)) {
                    this.createEmergencyAlert(aircraft);
                    this.setAlertCooldown(alertKey);
                }
            }
        }
    }

    /**
     * Check for watchlist aircraft appearances
     */
    checkWatchlistAppearances(watchlist) {
        if (!watchlist || watchlist.length === 0) return;
        
        const aircraftMap = this.store?.getState().live.aircraft || new Map();
        
        for (const hex of watchlist) {
            const aircraft = aircraftMap.get(hex);
            if (aircraft) {
                const alertKey = `watchlist-${hex}`;
                
                if (!this.isAlertCooledDown(alertKey)) {
                    this.createWatchlistAlert(aircraft);
                    this.setAlertCooldown(alertKey);
                }
            }
        }
    }

    /**
     * Check connection status for system alerts
     */
    checkConnectionStatus(status) {
        if (status === 'error' || status === 'offline') {
            const alertKey = `connection-${status}`;
            
            if (!this.isAlertCooledDown(alertKey)) {
                this.createConnectionAlert(status);
                this.setAlertCooldown(alertKey);
            }
        }
    }

    /**
     * Create emergency alert
     */
    createEmergencyAlert(aircraft) {
        const squawkTypes = {
            '7500': 'HIJACKING',
            '7600': 'COMMUNICATION FAILURE', 
            '7700': 'GENERAL EMERGENCY'
        };
        
        const alert = {
            id: `emergency-${Date.now()}`,
            type: 'emergency',
            severity: 'critical',
            title: `EMERGENCY - ${squawkTypes[aircraft.squawk] || 'Unknown Emergency'}`,
            message: `Aircraft ${aircraft.flight || aircraft.hex} is broadcasting emergency squawk ${aircraft.squawk}`,
            timestamp: new Date().toISOString(),
            data: {
                aircraft: {
                    hex: aircraft.hex,
                    callsign: aircraft.flight,
                    squawk: aircraft.squawk,
                    lat: aircraft.lat,
                    lon: aircraft.lon,
                    altitude: aircraft.altitude
                }
            },
            actions: [
                {
                    label: 'Track Aircraft',
                    action: 'track',
                    target: aircraft.hex
                },
                {
                    label: 'Add to Watchlist',
                    action: 'watchlist',
                    target: aircraft.hex
                }
            ]
        };
        
        this.addAlert(alert);
        this.showNotification(alert);
    }

    /**
     * Create watchlist alert
     */
    createWatchlistAlert(aircraft) {
        const alert = {
            id: `watchlist-${Date.now()}`,
            type: 'watchlist',
            severity: aircraft.military ? 'high' : 'medium',
            title: 'Watchlist Aircraft Appeared',
            message: `${aircraft.flight || aircraft.hex} from your watchlist is now visible`,
            timestamp: new Date().toISOString(),
            data: {
                aircraft: {
                    hex: aircraft.hex,
                    callsign: aircraft.flight,
                    military: aircraft.military,
                    lat: aircraft.lat,
                    lon: aircraft.lon
                }
            },
            actions: [
                {
                    label: 'View Details',
                    action: 'details',
                    target: aircraft.hex
                },
                {
                    label: 'Track on Map',
                    action: 'track',
                    target: aircraft.hex
                }
            ]
        };
        
        this.addAlert(alert);
        this.showNotification(alert);
    }

    /**
     * Create connection alert
     */
    createConnectionAlert(status) {
        const alert = {
            id: `connection-${Date.now()}`,
            type: 'system',
            severity: status === 'offline' ? 'high' : 'medium',
            title: status === 'offline' ? 'System Offline' : 'Connection Error',
            message: status === 'offline' ? 
                'Data feed is offline. Aircraft tracking unavailable.' :
                'Connection error occurred. Retrying...',
            timestamp: new Date().toISOString(),
            data: { status }
        };
        
        this.addAlert(alert);
    }

    /**
     * Create geofence alert (called from GeofenceTool)
     */
    createGeofenceAlert(event) {
        const alert = {
            id: `geofence-${Date.now()}`,
            type: 'geofence',
            severity: event.aircraft.emergency ? 'critical' : 
                     event.aircraft.military ? 'high' : 'medium',
            title: `Aircraft ${event.type === 'enter' ? 'Entered' : 'Exited'} Geofence`,
            message: `${event.aircraft.callsign} ${event.type === 'enter' ? 'entered' : 'exited'} ${event.geofence.name}`,
            timestamp: event.timestamp,
            data: event,
            actions: [
                {
                    label: 'View Aircraft',
                    action: 'details',
                    target: event.aircraft.hex
                },
                {
                    label: 'View Geofence',
                    action: 'geofence',
                    target: event.geofence.id
                }
            ]
        };
        
        this.addAlert(alert);
        this.showNotification(alert);
    }

    /**
     * Add alert to the system
     */
    addAlert(alert) {
        this.alerts.set(alert.id, alert);
        this.alertHistory.push(alert);
        
        // Limit history size
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
        }
        
        // Update UI
        this.debouncedUpdateUI();
        
        // Update alert count in dashboard
        if (this.store) {
            this.store.setState('ui.alertCount', this.alerts.size);
        }
        
        console.log(`🚨 Alert created: ${alert.title}`);
    }

    /**
     * Dismiss alert
     */
    dismissAlert(alertId) {
        this.alerts.delete(alertId);
        this.debouncedUpdateUI();
        
        // Update alert count
        if (this.store) {
            this.store.setState('ui.alertCount', this.alerts.size);
        }
    }

    /**
     * Clear all active alerts
     */
    clearAllAlerts() {
        if (this.alerts.size === 0) return;
        
        if (confirm(`Clear all ${this.alerts.size} active alerts?`)) {
            this.alerts.clear();
            this.render();
            
            if (this.store) {
                this.store.setState('ui.alertCount', 0);
            }
        }
    }

    /**
     * Clear alert history
     */
    clearAlertHistory() {
        if (confirm('Clear alert history? This cannot be undone.')) {
            this.alertHistory = [];
            console.log('Alert history cleared');
        }
    }

    /**
     * Handle alert click
     */
    handleAlertClick(alert) {
        // Auto-dismiss low severity alerts when clicked
        if (alert.severity === 'low' || alert.severity === 'medium') {
            this.dismissAlert(alert.id);
        }
        
        // Execute default action if available
        if (alert.actions && alert.actions.length > 0) {
            this.executeAlertAction(alert.actions[0], alert);
        } else if (alert.data?.aircraft?.hex) {
            // Default to showing aircraft details
            this.showAircraftDetails(alert.data.aircraft.hex);
        }
    }

    /**
     * Execute alert action
     */
    executeAlertAction(action, alert) {
        switch (action.action) {
            case 'track':
                this.trackAircraft(action.target);
                break;
            case 'details':
                this.showAircraftDetails(action.target);
                break;
            case 'watchlist':
                this.addToWatchlist(action.target);
                break;
            case 'geofence':
                this.showGeofence(action.target);
                break;
            default:
                console.warn('Unknown alert action:', action);
        }
    }

    /**
     * Track aircraft on map
     */
    trackAircraft(hex) {
        const aircraftMap = this.store?.getState().live.aircraft;
        const aircraft = aircraftMap?.get(hex);
        
        if (aircraft && aircraft.lat && aircraft.lon) {
            const mapComponent = window.OSINTTracker?.components?.get('map');
            if (mapComponent) {
                mapComponent.flyToAircraft(aircraft);
            }
        }
    }

    /**
     * Show aircraft details
     */
    showAircraftDetails(hex) {
        if (this.store) {
            this.store.setState('ui.selectedAircraftHex', hex);
            this.store.setState('ui.isDetailsPanelOpen', true);
        }
    }

    /**
     * Add aircraft to watchlist
     */
    addToWatchlist(hex) {
        if (!this.store) return;
        
        const currentWatchlist = this.store.getState().user.watchlist || [];
        if (!currentWatchlist.includes(hex)) {
            const newWatchlist = [...currentWatchlist, hex];
            this.store.setState('user.watchlist', newWatchlist);
            this.store.persistState(['user']);
        }
    }

    /**
     * Show geofence
     */
    showGeofence(geofenceId) {
        // Switch to geofences tab and focus on specific geofence
        if (this.store) {
            this.store.setState('ui.activeTab', 'geofences');
        }
        
        // TODO: Focus on specific geofence
        console.log('Show geofence:', geofenceId);
    }

    /**
     * Show notification
     */
    showNotification(alert) {
        // Browser notification
        if (this.notificationPermission === 'granted') {
            const notification = new Notification(alert.title, {
                body: alert.message,
                icon: this.getNotificationIcon(alert.type),
                tag: alert.id,
                requireInteraction: alert.severity === 'critical'
            });
            
            notification.onclick = () => {
                window.focus();
                this.handleAlertClick(alert);
                notification.close();
            };
            
            // Auto-close after 10 seconds for non-critical alerts
            if (alert.severity !== 'critical') {
                setTimeout(() => notification.close(), 10000);
            }
        }
        
        // Toast notification
        this.showToast(alert);
    }

    /**
     * Show toast notification
     */
    showToast(alert) {
        const template = document.getElementById('toast-template');
        if (!template) return;
        
        const toast = template.content.cloneNode(true);
        const container = toast.querySelector('.toast');
        
        if (!container) return;
        
        // Set severity class
        container.className = `toast severity-${alert.severity}`;
        
        // Set content
        const title = toast.querySelector('.toast-title');
        if (title) title.textContent = alert.title;
        
        const message = toast.querySelector('.toast-message');
        if (message) message.textContent = alert.message;
        
        // Add to page
        document.body.appendChild(toast);
        
        // Show with animation
        setTimeout(() => container.classList.add('show'), 100);
        
        // Auto-dismiss
        const dismissDelay = alert.severity === 'critical' ? 0 : 5000;
        if (dismissDelay > 0) {
            setTimeout(() => {
                container.classList.remove('show');
                setTimeout(() => container.remove(), 300);
            }, dismissDelay);
        }
        
        // Manual dismiss
        const closeBtn = container.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.classList.remove('show');
                setTimeout(() => container.remove(), 300);
            });
        }
    }

    /**
     * Check if alert is in cooldown period
     */
    isAlertCooledDown(alertKey) {
        const lastAlert = this.alertCooldowns.get(alertKey);
        if (!lastAlert) return false;
        
        return (Date.now() - lastAlert) < this.cooldownDuration;
    }

    /**
     * Set alert cooldown
     */
    setAlertCooldown(alertKey) {
        this.alertCooldowns.set(alertKey, Date.now());
    }

    /**
     * Update UI
     */
    updateUI() {
        this.render();
    }

    /**
     * Create test alert
     */
    createTestAlert() {
        const alert = {
            id: `test-${Date.now()}`,
            type: 'test',
            severity: 'medium',
            title: 'Test Alert',
            message: 'This is a test alert to verify the system is working correctly.',
            timestamp: new Date().toISOString(),
            data: {}
        };
        
        this.addAlert(alert);
        this.showNotification(alert);
    }

    /**
     * Get alert icon
     */
    getAlertIcon(type, severity) {
        const icons = {
            emergency: '🚨',
            watchlist: '👁️',
            geofence: '📍',
            system: '⚠️',
            test: '🧪'
        };
        
        return icons[type] || '🔔';
    }

    /**
     * Get notification icon
     */
    getNotificationIcon(type) {
        // Return path to icon file or data URL
        return '/favicon.ico'; // Placeholder
    }

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Get alert statistics
     */
    getStatistics() {
        const now = Date.now();
        const last24h = this.alertHistory.filter(alert => 
            now - new Date(alert.timestamp).getTime() < 24 * 60 * 60 * 1000
        );
        
        const severityCounts = last24h.reduce((acc, alert) => {
            acc[alert.severity] = (acc[alert.severity] || 0) + 1;
            return acc;
        }, {});
        
        const typeCounts = last24h.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
        }, {});
        
        return {
            total: this.alerts.size,
            last24h: last24h.length,
            totalHistory: this.alertHistory.length,
            severityCounts,
            typeCounts
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.alerts.clear();
        this.alertHistory = [];
        this.alertCooldowns.clear();
        this.alertCounters.clear();
        this.container = null;
        
        console.log('🚨 Alert System destroyed');
    }
}