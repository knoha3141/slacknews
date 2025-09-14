import AWS from 'aws-sdk';

const ssm = new AWS.SSM({ region: 'us-east-1' });

export interface AppConfig {
  geminiApiKey: string;
  slackToken: string;
  slackChannelId: string;
}

export async function loadConfig(): Promise<AppConfig> {
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

    const config: Partial<AppConfig> = {};
    
    result.Parameters.forEach(param => {
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