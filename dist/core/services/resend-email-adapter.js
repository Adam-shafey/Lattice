"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendEmailAdapter = void 0;
const resend_1 = require("resend");
class ResendEmailAdapter {
    constructor(config) {
        this.resend = new resend_1.Resend(config.apiKey);
        this.from = config.from;
    }
    async send(message) {
        const emailData = {
            from: this.from,
            to: message.to,
            subject: message.subject,
        };
        if (message.html) {
            emailData.html = message.html;
        }
        if (message.text) {
            emailData.text = message.text;
        }
        await this.resend.emails.send(emailData);
    }
}
exports.ResendEmailAdapter = ResendEmailAdapter;
