/**
 * Client-Side Router
 * 
 * Implements client-side routing using the History API for SPA navigation
 * without triggering page reloads, as specified in the blueprint.
 */

/**
 * Route class for managing individual routes
 */
class Route {
    constructor(path, handler, options = {}) {
        this.path = path;
        this.handler = handler;
        this.options = options;
        this.params = {};
        this.regex = this.pathToRegex(path);
    }

    /**
     * Convert path pattern to regular expression
     */
    pathToRegex(path) {
        // Escape special regex characters except for parameter placeholders
        const escapedPath = path.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
        
        // Convert parameter placeholders (:param) to regex groups
        const regexPattern = escapedPath.replace(/\\:([a-zA-Z0-9_]+)/g, '(?<$1>[^/]+)');
        
        // Convert wildcard (*) to match anything
        const finalPattern = regexPattern.replace(/\\\*/g, '.*');
        
        return new RegExp(`^${finalPattern}$`);
    }

    /**
     * Check if the route matches the given path
     */
    matches(path) {
        const match = path.match(this.regex);
        if (match) {
            this.params = match.groups || {};
            return true;
        }
        return false;
    }

    /**
     * Execute the route handler
     */
    execute(context = {}) {
        try {
            return this.handler({ 
                params: this.params, 
                ...context 
            });
        } catch (error) {
            console.error('Route handler error:', error);
            throw error;
        }
    }
}

/**
 * Router class for managing application navigation
 */
export class Router {
    constructor(routes = {}, options = {}) {
        this.routes = [];
        this.currentRoute = null;
        this.options = {
            mode: 'history', // 'history' or 'hash'
            root: '/',
            ...options
        };
        
        // Route middleware and hooks
        this.beforeHooks = [];
        this.afterHooks = [];
        this.errorHooks = [];
        
        // Navigation state
        this.isNavigating = false;
        this.navigationQueue = [];
        
        // Add routes from configuration
        Object.entries(routes).forEach(([path, handler]) => {
            this.addRoute(path, handler);
        });
        
        // Bind methods
        this.handlePopState = this.handlePopState.bind(this);
        this.handleHashChange = this.handleHashChange.bind(this);
    }

    /**
     * Add a route to the router
     */
    addRoute(path, handler, options = {}) {
        const route = new Route(path, handler, options);
        this.routes.push(route);
        return this;
    }

    /**
     * Remove a route from the router
     */
    removeRoute(path) {
        this.routes = this.routes.filter(route => route.path !== path);
        return this;
    }

    /**
     * Add middleware to run before route execution
     */
    beforeEach(hook) {
        this.beforeHooks.push(hook);
        return this;
    }

    /**
     * Add middleware to run after route execution
     */
    afterEach(hook) {
        this.afterHooks.push(hook);
        return this;
    }

    /**
     * Add error handler
     */
    onError(hook) {
        this.errorHooks.push(hook);
        return this;
    }

    /**
     * Start the router
     */
    start() {
        if (this.options.mode === 'history') {
            window.addEventListener('popstate', this.handlePopState);
        } else {
            window.addEventListener('hashchange', this.handleHashChange);
        }
        
        // Handle initial route
        this.handleInitialRoute();
        
        console.log('🗺️ Router started in', this.options.mode, 'mode');
        return this;
    }

    /**
     * Stop the router
     */
    stop() {
        if (this.options.mode === 'history') {
            window.removeEventListener('popstate', this.handlePopState);
        } else {
            window.removeEventListener('hashchange', this.handleHashChange);
        }
        
        console.log('🗺️ Router stopped');
        return this;
    }

    /**
     * Navigate to a path
     */
    async navigate(path, state = {}) {
        // Prevent navigation during another navigation
        if (this.isNavigating) {
            this.navigationQueue.push({ path, state });
            return;
        }

        try {
            this.isNavigating = true;
            
            const normalizedPath = this.normalizePath(path);
            
            // Run before hooks
            const context = { 
                from: this.getCurrentPath(), 
                to: normalizedPath, 
                state 
            };
            
            for (const hook of this.beforeHooks) {
                const result = await hook(context);
                if (result === false) {
                    // Navigation cancelled
                    this.isNavigating = false;
                    this.processNavigationQueue();
                    return false;
                }
            }

            // Update browser history
            this.updateHistory(normalizedPath, state);
            
            // Execute route
            await this.executeRoute(normalizedPath, context);
            
            // Run after hooks
            for (const hook of this.afterHooks) {
                await hook(context);
            }
            
            this.isNavigating = false;
            this.processNavigationQueue();
            
            return true;
            
        } catch (error) {
            this.isNavigating = false;
            this.handleNavigationError(error, path);
            this.processNavigationQueue();
            return false;
        }
    }

    /**
     * Replace current history entry
     */
    async replace(path, state = {}) {
        const normalizedPath = this.normalizePath(path);
        
        if (this.options.mode === 'history') {
            window.history.replaceState(state, '', normalizedPath);
        } else {
            window.location.hash = normalizedPath;
        }
        
        await this.executeRoute(normalizedPath, { state });
    }

    /**
     * Go back in history
     */
    back() {
        window.history.back();
    }

    /**
     * Go forward in history
     */
    forward() {
        window.history.forward();
    }

    /**
     * Go to specific history entry
     */
    go(delta) {
        window.history.go(delta);
    }

    /**
     * Get current path
     */
    getCurrentPath() {
        if (this.options.mode === 'history') {
            return window.location.pathname + window.location.search;
        } else {
            return window.location.hash.slice(1) || '/';
        }
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Check if path matches current route
     */
    isActive(path) {
        const normalizedPath = this.normalizePath(path);
        const currentPath = this.getCurrentPath();
        return currentPath === normalizedPath;
    }

    /**
     * Handle browser back/forward navigation
     */
    async handlePopState(event) {
        const path = this.getCurrentPath();
        await this.executeRoute(path, { 
            state: event.state || {},
            trigger: 'popstate'
        });
    }

    /**
     * Handle hash change navigation
     */
    async handleHashChange(event) {
        const path = this.getCurrentPath();
        await this.executeRoute(path, { 
            trigger: 'hashchange'
        });
    }

    /**
     * Handle initial route on page load
     */
    async handleInitialRoute() {
        const path = this.getCurrentPath();
        await this.executeRoute(path, { 
            trigger: 'initial'
        });
    }

    /**
     * Execute route handler for given path
     */
    async executeRoute(path, context = {}) {
        try {
            const normalizedPath = this.normalizePath(path);
            const route = this.findRoute(normalizedPath);
            
            if (route) {
                this.currentRoute = route;
                await route.execute(context);
                
                // Dispatch custom event
                this.dispatchRouteEvent('route:change', {
                    route,
                    path: normalizedPath,
                    context
                });
                
            } else {
                // No matching route found
                await this.handleNotFound(normalizedPath, context);
            }
            
        } catch (error) {
            this.handleNavigationError(error, path);
        }
    }

    /**
     * Find route that matches the path
     */
    findRoute(path) {
        for (const route of this.routes) {
            if (route.matches(path)) {
                return route;
            }
        }
        return null;
    }

    /**
     * Handle 404 not found
     */
    async handleNotFound(path, context) {
        console.warn(`Route not found: ${path}`);
        
        // Look for a catch-all route
        const notFoundRoute = this.routes.find(route => route.path === '*' || route.path === '404');
        
        if (notFoundRoute) {
            this.currentRoute = notFoundRoute;
            await notFoundRoute.execute(context);
        } else {
            // Dispatch not found event
            this.dispatchRouteEvent('route:not-found', {
                path,
                context
            });
        }
    }

    /**
     * Handle navigation errors
     */
    handleNavigationError(error, path) {
        console.error('Navigation error:', error);
        
        // Run error hooks
        this.errorHooks.forEach(hook => {
            try {
                hook(error, path);
            } catch (hookError) {
                console.error('Error hook failed:', hookError);
            }
        });
        
        // Dispatch error event
        this.dispatchRouteEvent('route:error', {
            error,
            path
        });
    }

    /**
     * Update browser history
     */
    updateHistory(path, state) {
        if (this.options.mode === 'history') {
            if (window.location.pathname + window.location.search !== path) {
                window.history.pushState(state, '', path);
            }
        } else {
            const hash = '#' + path;
            if (window.location.hash !== hash) {
                window.location.hash = hash;
            }
        }
    }

    /**
     * Normalize path
     */
    normalizePath(path) {
        // Remove leading/trailing slashes and normalize
        const normalized = ('/' + path).replace(/\/+/g, '/').replace(/\/$/, '') || '/';
        
        // Apply root prefix if configured
        if (this.options.root !== '/' && !normalized.startsWith(this.options.root)) {
            return this.options.root + normalized;
        }
        
        return normalized;
    }

    /**
     * Process queued navigation requests
     */
    async processNavigationQueue() {
        if (this.navigationQueue.length > 0) {
            const { path, state } = this.navigationQueue.shift();
            await this.navigate(path, state);
        }
    }

    /**
     * Dispatch custom route events
     */
    dispatchRouteEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { 
            detail,
            bubbles: true,
            cancelable: true
        });
        
        window.dispatchEvent(event);
    }

    /**
     * Generate URL for a route with parameters
     */
    generateUrl(routePath, params = {}, query = {}) {
        let url = routePath;
        
        // Replace parameters in the path
        Object.entries(params).forEach(([key, value]) => {
            url = url.replace(`:${key}`, encodeURIComponent(value));
        });
        
        // Add query parameters
        const queryString = new URLSearchParams(query).toString();
        if (queryString) {
            url += '?' + queryString;
        }
        
        return this.normalizePath(url);
    }

    /**
     * Add route group with common prefix
     */
    group(prefix, callback) {
        const originalAddRoute = this.addRoute.bind(this);
        
        // Override addRoute temporarily
        this.addRoute = (path, handler, options) => {
            const fullPath = prefix + path;
            return originalAddRoute(fullPath, handler, options);
        };
        
        // Execute callback
        callback(this);
        
        // Restore original addRoute
        this.addRoute = originalAddRoute;
        
        return this;
    }

    /**
     * Get route parameters for current route
     */
    getParams() {
        return this.currentRoute ? { ...this.currentRoute.params } : {};
    }

    /**
     * Get query parameters from current URL
     */
    getQuery() {
        const queryString = window.location.search;
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /**
     * Check if router can navigate (no pending navigation)
     */
    canNavigate() {
        return !this.isNavigating;
    }

    /**
     * Get router state for debugging
     */
    getState() {
        return {
            currentPath: this.getCurrentPath(),
            currentRoute: this.currentRoute ? {
                path: this.currentRoute.path,
                params: this.currentRoute.params
            } : null,
            isNavigating: this.isNavigating,
            queueLength: this.navigationQueue.length,
            routeCount: this.routes.length
        };
    }
}

/**
 * Link component helper for navigation
 */
export class RouterLink {
    constructor(router, element) {
        this.router = router;
        this.element = element;
        this.bindEvents();
    }

    bindEvents() {
        this.element.addEventListener('click', this.handleClick.bind(this));
    }

    handleClick(event) {
        event.preventDefault();
        
        const href = this.element.getAttribute('href');
        const target = this.element.getAttribute('target');
        
        // Don't handle external links or new tab links
        if (target === '_blank' || href.startsWith('http')) {
            return;
        }
        
        this.router.navigate(href);
    }

    destroy() {
        this.element.removeEventListener('click', this.handleClick);
    }
}

/**
 * Auto-link helper to convert regular links to router links
 */
export function enableRouterLinks(router, container = document) {
    const links = container.querySelectorAll('a[href]:not([target="_blank"]):not([href^="http"])');
    const routerLinks = [];
    
    links.forEach(link => {
        const routerLink = new RouterLink(router, link);
        routerLinks.push(routerLink);
    });
    
    return routerLinks;
}

/**
 * Route guard helpers
 */
export const RouteGuards = {
    /**
     * Authentication guard
     */
    requireAuth: (isAuthenticated) => (context) => {
        if (!isAuthenticated()) {
            console.warn('Navigation blocked: authentication required');
            return false;
        }
        return true;
    },

    /**
     * Permission guard
     */
    requirePermission: (permission, hasPermission) => (context) => {
        if (!hasPermission(permission)) {
            console.warn(`Navigation blocked: permission '${permission}' required`);
            return false;
        }
        return true;
    },

    /**
     * Confirmation guard
     */
    requireConfirmation: (message) => (context) => {
        return confirm(message);
    },

    /**
     * Data loading guard
     */
    loadData: (loader) => async (context) => {
        try {
            context.data = await loader(context);
            return true;
        } catch (error) {
            console.error('Data loading failed:', error);
            return false;
        }
    }
};

/**
 * Router utilities
 */
export const RouterUtils = {
    /**
     * Parse query string
     */
    parseQuery: (queryString) => {
        return Object.fromEntries(new URLSearchParams(queryString));
    },

    /**
     * Build query string
     */
    buildQuery: (params) => {
        return new URLSearchParams(params).toString();
    },

    /**
     * Combine paths
     */
    joinPaths: (...paths) => {
        return paths
            .map(path => path.replace(/^\/+|\/+$/g, ''))
            .filter(Boolean)
            .join('/');
    },

    /**
     * Check if path is absolute
     */
    isAbsolute: (path) => {
        return path.startsWith('/') || /^https?:\/\//.test(path);
    }
};