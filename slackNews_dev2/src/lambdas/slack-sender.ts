import { Handler, ScheduledEvent } from 'aws-lambda';
import { SlackClient } from '../clients/slack-client';
import { NewsReport } from '../clients/gemini-client';
import { loadConfig } from '../utils/aws-config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME || 'slacknews-reports-390403878175';

export const handler: Handler<ScheduledEvent> = async (event, context) => {
  console.log('Slack Sender Lambda started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // 設定を読み込み
    const config = await loadConfig();
    console.log('Configuration loaded successfully');

    // 今日の日付でレポートファイルを検索
    const today = new Date().toISOString().split('T')[0];
    const reportKey = `reports/${today}.json`;

    console.log(`Looking for report: ${reportKey}`);

    // S3からレポートを取得
    let newsReport: NewsReport;
    try {
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: reportKey
      });
      const s3Object = await s3Client.send(getCommand);

      if (!s3Object.Body) {
        throw new Error('Report file is empty');
      }

      const bodyString = await s3Object.Body?.transformToString();
      if (!bodyString) {
        throw new Error('Failed to read report body');
      }
      newsReport = JSON.parse(bodyString);
      console.log(`Report loaded: ${newsReport.totalCount} articles`);
    } catch (s3Error) {
      console.error('Failed to load report from S3:', s3Error);
      
      // フォールバック: 昨日のレポートを試す
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `reports/${yesterday.toISOString().split('T')[0]}.json`;
      
      console.log(`Trying fallback report: ${yesterdayKey}`);
      
      const fallbackCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: yesterdayKey
      });
      const fallbackObject = await s3Client.send(fallbackCommand);

      if (!fallbackObject.Body) {
        throw new Error('Fallback report file is empty');
      }

      const fallbackBodyString = await fallbackObject.Body?.transformToString();
      if (!fallbackBodyString) {
        throw new Error('Failed to read fallback report body');
      }
      newsReport = JSON.parse(fallbackBodyString);
      console.log(`Fallback report loaded: ${newsReport.totalCount} articles`);
    }

    // Slack クライアントを初期化
    const slackClient = new SlackClient(config.slackToken);

    // Slack接続をテスト
    const isConnected = await slackClient.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Slack');
    }
    console.log('Slack connection verified');

    // ニュースレポートをSlackに送信
    console.log(`Sending report to channel: ${config.slackChannelId}`);
    const sendResult = await slackClient.sendNewsReport(config.slackChannelId, newsReport);

    if (!sendResult) {
      throw new Error('Failed to send message to Slack');
    }

    console.log('News report sent to Slack successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'News report sent to Slack successfully',
        reportDate: newsReport.date,
        articleCount: newsReport.totalCount,
        channelId: config.slackChannelId
      })
    };

  } catch (error) {
    console.error('Error in slack sender:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to send news report to Slack',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};