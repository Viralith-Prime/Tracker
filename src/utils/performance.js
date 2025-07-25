/**
 * Performance Utilities
 * 
 * Provides debouncing, throttling, and other performance optimization utilities
 * to ensure a fluid user experience as specified in the blueprint.
 */

/**
 * Debounce function - executes after a period of inactivity
 * Ideal for expensive operations like refetching data after user stops panning
 */
export function debounce(func, delay) {
    let timeoutId;
    
    return function debounced(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Throttle function - limits execution to once every N milliseconds
 * Ideal for continuous updates like coordinate display during map pan
 */
export function throttle(func, limit) {
    let inThrottle;
    
    return function throttled(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Request Animation Frame throttle for smooth animations
 */
export function rafThrottle(func) {
    let rafId;
    let lastArgs;
    
    return function rafThrottled(...args) {
        lastArgs = args;
        
        if (!rafId) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, lastArgs);
                rafId = null;
            });
        }
    };
}

/**
 * Batch DOM operations to minimize reflows and repaints
 */
export function batchDOMOperations(operations) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const results = operations.map(op => op());
            resolve(results);
        });
    });
}

/**
 * Efficient array operations for large datasets
 */
export class OptimizedArray {
    constructor(items = []) {
        this.items = items;
        this.indexMap = new Map();
        this.rebuildIndex();
    }
    
    rebuildIndex() {
        this.indexMap.clear();
        this.items.forEach((item, index) => {
            if (item && typeof item === 'object' && item.id) {
                this.indexMap.set(item.id, index);
            }
        });
    }
    
    findById(id) {
        const index = this.indexMap.get(id);
        return index !== undefined ? this.items[index] : null;
    }
    
    updateById(id, updates) {
        const index = this.indexMap.get(id);
        if (index !== undefined) {
            this.items[index] = { ...this.items[index], ...updates };
            return true;
        }
        return false;
    }
    
    removeById(id) {
        const index = this.indexMap.get(id);
        if (index !== undefined) {
            this.items.splice(index, 1);
            this.rebuildIndex();
            return true;
        }
        return false;
    }
    
    bulkUpdate(updates) {
        const startTime = performance.now();
        
        updates.forEach(({ id, data }) => {
            const index = this.indexMap.get(id);
            if (index !== undefined) {
                this.items[index] = { ...this.items[index], ...data };
            } else {
                this.items.push(data);
            }
        });
        
        this.rebuildIndex();
        
        const endTime = performance.now();
        console.log(`Bulk update completed in ${endTime - startTime}ms`);
    }
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
    constructor(threshold = 100) { // MB
        this.threshold = threshold * 1024 * 1024; // Convert to bytes
        this.measurements = [];
    }
    
    measure() {
        if (performance.memory) {
            const memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                timestamp: Date.now()
            };
            
            this.measurements.push(memory);
            
            // Keep only last 100 measurements
            if (this.measurements.length > 100) {
                this.measurements.shift();
            }
            
            // Check if we're approaching the threshold
            if (memory.used > this.threshold) {
                console.warn(`Memory usage high: ${Math.round(memory.used / 1024 / 1024)}MB`);
                return false;
            }
            
            return memory;
        }
        
        return null;
    }
    
    getAverageUsage() {
        if (this.measurements.length === 0) return 0;
        
        const total = this.measurements.reduce((sum, m) => sum + m.used, 0);
        return total / this.measurements.length;
    }
    
    getTrend() {
        if (this.measurements.length < 2) return 'stable';
        
        const recent = this.measurements.slice(-10);
        const older = this.measurements.slice(-20, -10);
        
        if (recent.length === 0 || older.length === 0) return 'stable';
        
        const recentAvg = recent.reduce((sum, m) => sum + m.used, 0) / recent.length;
        const olderAvg = older.reduce((sum, m) => sum + m.used, 0) / older.length;
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }
}

/**
 * Frame rate monitor for performance tracking
 */
export class FrameRateMonitor {
    constructor() {
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.history = [];
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.loop();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    loop() {
        if (!this.isRunning) return;
        
        this.frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;
        
        if (elapsed >= 1000) { // Update every second
            this.fps = Math.round((this.frameCount * 1000) / elapsed);
            this.history.push({
                fps: this.fps,
                timestamp: currentTime
            });
            
            // Keep only last 60 seconds of history
            if (this.history.length > 60) {
                this.history.shift();
            }
            
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        requestAnimationFrame(() => this.loop());
    }
    
    getCurrentFPS() {
        return this.fps;
    }
    
    getAverageFPS() {
        if (this.history.length === 0) return 0;
        
        const total = this.history.reduce((sum, h) => sum + h.fps, 0);
        return Math.round(total / this.history.length);
    }
    
    getHistory() {
        return [...this.history];
    }
}

/**
 * Viewport intersection observer for performance optimization
 */
export class ViewportObserver {
    constructor(callback, options = {}) {
        this.callback = callback;
        this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
            threshold: options.threshold || 0.1,
            rootMargin: options.rootMargin || '50px'
        });
        this.observedElements = new Map();
    }
    
    observe(element, data = {}) {
        this.observedElements.set(element, data);
        this.observer.observe(element);
    }
    
    unobserve(element) {
        this.observedElements.delete(element);
        this.observer.unobserve(element);
    }
    
    handleIntersection(entries) {
        entries.forEach(entry => {
            const data = this.observedElements.get(entry.target);
            this.callback(entry, data);
        });
    }
    
    disconnect() {
        this.observer.disconnect();
        this.observedElements.clear();
    }
}

/**
 * Efficient DOM manipulation utilities
 */
export class DOMOptimizer {
    static createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        // Set attributes
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on')) {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Add children
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    }
    
    static batchStyleChanges(element, styles) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                Object.assign(element.style, styles);
                resolve();
            });
        });
    }
    
    static replaceContent(container, newContent) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                // Use DocumentFragment for efficient DOM manipulation
                const fragment = document.createDocumentFragment();
                
                if (typeof newContent === 'string') {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newContent;
                    while (tempDiv.firstChild) {
                        fragment.appendChild(tempDiv.firstChild);
                    }
                } else if (Array.isArray(newContent)) {
                    newContent.forEach(item => {
                        if (item instanceof Node) {
                            fragment.appendChild(item);
                        }
                    });
                } else if (newContent instanceof Node) {
                    fragment.appendChild(newContent);
                }
                
                // Clear and replace content in one operation
                container.innerHTML = '';
                container.appendChild(fragment);
                resolve();
            });
        });
    }
}

/**
 * Web Worker helper for offloading heavy computations
 */
export class WorkerPool {
    constructor(workerScript, poolSize = navigator.hardwareConcurrency || 4) {
        this.workerScript = workerScript;
        this.poolSize = poolSize;
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
        this.taskId = 0;
        
        this.initializeWorkers();
    }
    
    initializeWorkers() {
        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(this.workerScript);
            worker.onmessage = this.handleWorkerMessage.bind(this);
            worker.onerror = this.handleWorkerError.bind(this);
            
            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
    }
    
    execute(data, transferables = []) {
        return new Promise((resolve, reject) => {
            const taskId = ++this.taskId;
            const task = {
                id: taskId,
                data,
                transferables,
                resolve,
                reject,
                timestamp: performance.now()
            };
            
            if (this.availableWorkers.length > 0) {
                this.runTask(task);
            } else {
                this.taskQueue.push(task);
            }
        });
    }
    
    runTask(task) {
        const worker = this.availableWorkers.pop();
        worker.currentTask = task;
        
        worker.postMessage({
            id: task.id,
            data: task.data
        }, task.transferables);
    }
    
    handleWorkerMessage(event) {
        const worker = event.target;
        const task = worker.currentTask;
        
        if (task && task.id === event.data.id) {
            task.resolve(event.data.result);
            this.finishTask(worker);
        }
    }
    
    handleWorkerError(event) {
        const worker = event.target;
        const task = worker.currentTask;
        
        if (task) {
            task.reject(new Error(event.message));
            this.finishTask(worker);
        }
    }
    
    finishTask(worker) {
        worker.currentTask = null;
        this.availableWorkers.push(worker);
        
        // Process next task in queue
        if (this.taskQueue.length > 0) {
            const nextTask = this.taskQueue.shift();
            this.runTask(nextTask);
        }
    }
    
    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.availableWorkers = [];
        this.taskQueue = [];
    }
}

/**
 * Performance measurement utilities
 */
export class PerformanceProfiler {
    constructor() {
        this.measurements = new Map();
        this.marks = new Map();
    }
    
    mark(name) {
        const timestamp = performance.now();
        this.marks.set(name, timestamp);
        return timestamp;
    }
    
    measure(name, startMark, endMark) {
        const startTime = this.marks.get(startMark) || performance.now();
        const endTime = endMark ? this.marks.get(endMark) : performance.now();
        const duration = endTime - startTime;
        
        if (!this.measurements.has(name)) {
            this.measurements.set(name, []);
        }
        
        this.measurements.get(name).push({
            duration,
            timestamp: endTime
        });
        
        return duration;
    }
    
    getAverage(name) {
        const measurements = this.measurements.get(name);
        if (!measurements || measurements.length === 0) return 0;
        
        const total = measurements.reduce((sum, m) => sum + m.duration, 0);
        return total / measurements.length;
    }
    
    getStats(name) {
        const measurements = this.measurements.get(name);
        if (!measurements || measurements.length === 0) {
            return { count: 0, average: 0, min: 0, max: 0 };
        }
        
        const durations = measurements.map(m => m.duration);
        
        return {
            count: measurements.length,
            average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            recent: durations.slice(-10) // Last 10 measurements
        };
    }
    
    clear(name) {
        if (name) {
            this.measurements.delete(name);
            this.marks.delete(name);
        } else {
            this.measurements.clear();
            this.marks.clear();
        }
    }
}

// Export a global profiler instance
export const profiler = new PerformanceProfiler();