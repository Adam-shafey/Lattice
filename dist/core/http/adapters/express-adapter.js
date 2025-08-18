"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpressAdapter = createExpressAdapter;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const extract_request_context_1 = require("../utils/extract-request-context");
const logger_1 = require("../../logger");
/**
 * Creates an Express HTTP adapter for the LatticeCore application
 *
 * This adapter wraps Express.js functionality to provide a consistent
 * interface for route registration and server management.
 *
 * @param app - The LatticeCore application instance
 * @returns ExpressHttpAdapter instance
 */
function createExpressAdapter(app) {
    const instance = (0, express_1.default)();
    // Configure CORS
    // Allowed origins can be provided either via the LatticeCore config
    // (`allowedOrigins`) or through the CORS_ALLOWED_ORIGINS environment
    // variable (comma-separated).
    // Example: CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
    // By default, no origins are allowed.
    const allowedOrigins = app?.config?.allowedOrigins ??
        process.env.CORS_ALLOWED_ORIGINS?.split(',')
            .map((o) => o.trim())
            .filter(Boolean) ??
        [];
    instance.use((0, cors_1.default)({
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    // Configure Express middleware
    instance.use(express_1.default.json());
    instance.use(express_1.default.urlencoded({ extended: true }));
    /**
     * Wraps a pre-handler function to work with Express middleware
     */
    function wrapPreHandler(handler) {
        return handler;
    }
    /**
     * Wraps a route handler to work with Express
     *
     * Extracts user and context information from the request and
     * passes it to the handler in a standardized format.
     */
    function wrapHandler(handler) {
        return async function (req, res) {
            try {
                const { user, context, body, params, query } = (0, extract_request_context_1.extractRequestContext)(req);
                const result = await handler({
                    user,
                    context,
                    body,
                    params: params,
                    query: query,
                    req,
                });
                // Send the response
                res.send(result);
            }
            catch (error) {
                // Handle errors gracefully
                logger_1.logger.error('Express handler error:', error);
                res.status(500).send({
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        };
    }
    const adapter = {
        /**
         * Adds a route to the Express application
         */
        addRoute(route) {
            const preHandlers = Array.isArray(route.preHandler)
                ? route.preHandler
                : route.preHandler
                    ? [route.preHandler]
                    : [];
            const handlers = [...preHandlers.map(wrapPreHandler), wrapHandler(route.handler)];
            // Register the route based on HTTP method
            switch (route.method) {
                case 'GET':
                    instance.get(route.path, ...handlers);
                    break;
                case 'POST':
                    instance.post(route.path, ...handlers);
                    break;
                case 'PUT':
                    instance.put(route.path, ...handlers);
                    break;
                case 'PATCH':
                    instance.patch(route.path, ...handlers);
                    break;
                case 'DELETE':
                    instance.delete(route.path, ...handlers);
                    break;
                default:
                    throw new Error(`Unsupported HTTP method: ${route.method}`);
            }
        },
        /**
         * Starts the Express server
         */
        async listen(port, host) {
            return new Promise((resolve) => {
                instance.listen(port, host ?? '0.0.0.0', () => {
                    logger_1.logger.log(`Express server listening on http://${host ?? '0.0.0.0'}:${port}`);
                    resolve();
                });
            });
        },
        /**
         * Returns the underlying Express instance
         */
        getUnderlying() {
            return instance;
        },
    };
    return adapter;
}
