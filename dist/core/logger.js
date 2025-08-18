"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
class Logger {
    constructor() {
        const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
        this.logger = (0, pino_1.default)({ level });
    }
    get pino() {
        return this.logger;
    }
    enable() {
        this.logger.level = 'debug';
    }
    disable() {
        this.logger.level = 'silent';
    }
    isEnabled() {
        return this.logger.level !== 'silent';
    }
    log(...args) {
        this.logger.info(args);
    }
    warn(...args) {
        this.logger.warn(args);
    }
    error(...args) {
        this.logger.error(args);
    }
}
exports.logger = new Logger();
exports.logger.log(`📝 [LOGGER] Initialized. Level: ${exports.logger.pino.level}`);
