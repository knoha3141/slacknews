"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const ssm = new aws_sdk_1.default.SSM({ region: 'us-east-1' });
async function loadConfig() {
    try {
        const params = {
            Names: [
                '/slacknews/gemini-api-key',
                '/slacknews/slack-token',
                '/slacknews/slack-channel-id'
            ],
            WithDecryption: true
        };
        const result = await ssm.getParameters(params).promise();
        if (!result.Parameters || result.Parameters.length < 3) {
            throw new Error('Missing required configuration parameters');
        }
        const config = {};
        result.Parameters.forEach(param => {
            if (!param.Name || !param.Value)
                return;
            switch (param.Name) {
                case '/slacknews/gemini-api-key':
                    config.geminiApiKey = param.Value;
                    break;
                case '/slacknews/slack-token':
                    config.slackToken = param.Value;
                    break;
                case '/slacknews/slack-channel-id':
                    config.slackChannelId = param.Value;
                    break;
            }
        });
        if (!config.geminiApiKey || !config.slackToken || !config.slackChannelId) {
            throw new Error('Invalid configuration parameters');
        }
        return config;
    }
    catch (error) {
        console.error('Failed to load configuration:', error);
        throw error;
    }
}
