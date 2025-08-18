"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleEmailAdapter = void 0;
const logger_1 = require("../logger");
class ConsoleEmailAdapter {
    async send(message) {
        logger_1.logger.log(`Sending email to ${message.to}: ${message.subject}`);
    }
}
exports.ConsoleEmailAdapter = ConsoleEmailAdapter;
