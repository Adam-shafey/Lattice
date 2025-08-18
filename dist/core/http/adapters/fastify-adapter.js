"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFastifyAdapter = createFastifyAdapter;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const extract_request_context_1 = require("../utils/extract-request-context");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../logger");
/**
 * Creates a Fastify HTTP adapter for the LatticeCore application
 */
function createFastifyAdapter(app) {
    const instance = (0, fastify_1.default)({
        logger: true,
        trustProxy: true
    });
    // Configure CORS
    // Allowed origins can be specified via the LatticeCore config
    // (`allowedOrigins`) or the CORS_ALLOWED_ORIGINS environment variable
    // (comma-separated).
    // Example: CORS_ALLOWED_ORIGINS="https://app.example.com,https://admin.example.com"
    // Defaults to an empty array to disallow all cross-origin requests unless
    // explicitly configured.
    const allowedOrigins = app?.config?.allowedOrigins ??
        process.env.CORS_ALLOWED_ORIGINS?.split(',')
            .map((o) => o.trim())
            .filter(Boolean) ??
        [];
    instance.register(cors_1.default, {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
    // Rate limiting plugin (configured per-route)
    instance.register(rate_limit_1.default, { global: false });
    // Read the generated swagger spec
    const swaggerSpecPath = path_1.default.join(__dirname, '../../../swagger-output.json');
    let swaggerSpec = {};
    try {
        if (fs_1.default.existsSync(swaggerSpecPath)) {
            swaggerSpec = JSON.parse(fs_1.default.readFileSync(swaggerSpecPath, 'utf8'));
        }
    }
    catch (error) {
        logger_1.logger.warn('Could not load swagger spec, using minimal configuration');
    }
    // Swagger configuration using our generated spec
    instance.register(swagger_1.default, {
        mode: 'static',
        specification: {
            document: swaggerSpec
        }
    });
    // Swagger UI configuration
    instance.register(swagger_ui_1.default, {
        routePrefix: '/docs',
        uiConfig: {
            docExpansion: 'list',
            deepLinking: true
        },
        staticCSP: true,
        transformStaticCSP: (header) => header
    });
    /**
     * Wraps a route handler to work with Fastify
     */
    function wrapHandler(handler) {
        return async function (request, reply) {
            try {
                const { user, context, body, params, query } = (0, extract_request_context_1.extractRequestContext)(request);
                const result = await handler({
                    user,
                    context,
                    body,
                    params: params,
                    query: query,
                    req: request,
                });
                if (!reply.sent) {
                    reply.send(result);
                }
            }
            catch (error) {
                logger_1.logger.error('Fastify handler error:', error);
                if (reply.sent)
                    return;
                if (error && typeof error === 'object' && 'statusCode' in error) {
                    const statusCode = error.statusCode;
                    const response = {
                        error: 'Invalid input',
                        message: error instanceof Error ? error.message : 'Unknown error'
                    };
                    if ('issues' in error) {
                        response.issues = error.issues;
                    }
                    reply.status(statusCode).send(response);
                }
                else {
                    reply.status(500).send({
                        error: 'Internal server error',
                        message: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
        };
    }
    /**
     * Wraps a pre-handler function to work with Fastify middleware
     */
    function wrapPreHandler(pre) {
        return function (request, reply, done) {
            try {
                const next = (err) => (err ? done(err) : done());
                const maybePromise = pre(request, reply, next);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise
                        .then(() => {
                        if (!reply.sent)
                            done();
                    })
                        .catch((err) => {
                        if (!reply.sent)
                            done(err);
                    });
                }
                else {
                    if (!reply.sent)
                        done();
                }
            }
            catch (err) {
                if (!reply.sent)
                    done(err);
            }
        };
    }
    const adapter = {
        addRoute(route) {
            const preHandlers = Array.isArray(route.preHandler)
                ? route.preHandler
                : route.preHandler
                    ? [route.preHandler]
                    : [];
            instance.route({
                method: route.method,
                url: route.path,
                config: route.config,
                preHandler: preHandlers.map(wrapPreHandler),
                handler: wrapHandler(route.handler),
            });
        },
        async listen(port, host) {
            await instance.listen({ port, host });
        },
        getUnderlying() {
            return instance;
        },
    };
    return adapter;
}
