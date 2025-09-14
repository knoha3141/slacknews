"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const client_ssm_1 = require("@aws-sdk/client-ssm");
const ssmClient = new client_ssm_1.SSMClient({ region: 'us-east-1' });
async function loadConfig() {
    try {
        const command = new client_ssm_1.GetParametersCommand({
            Names: [
                '/slacknews/gemini-api-key',
                '/slacknews/slack-token',
                '/slacknews/slack-channel-id'
            ],
            WithDecryption: true
        });
        const result = await ssmClient.send(command);
        if (!result.Parameters || result.Parameters.length < 3) {
            throw new Error('Missing required configuration parameters');
        }
        const config = {};
        result.Parameters.forEach((param) => {
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
