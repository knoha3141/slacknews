import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

export interface AppConfig {
  geminiApiKey: string;
  slackToken: string;
  slackChannelId: string;
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const command = new GetParametersCommand({
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

    const config: Partial<AppConfig> = {};
    
    result.Parameters.forEach((param: any) => {
      if (!param.Name || !param.Value) return;
      
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

    return config as AppConfig;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw error;
  }
}