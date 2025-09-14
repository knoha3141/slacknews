import { Handler, ScheduledEvent, Context } from 'aws-lambda';
import { GeminiClient } from '../clients/gemini-client';
import { loadConfig } from '../utils/aws-config';
import AWS from 'aws-sdk';

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME || 'slacknews-reports-390403878175';

export const handler: Handler<ScheduledEvent> = async (event, context) => {
  console.log('News Collector Lambda started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // 設定を読み込み
    const config = await loadConfig();
    console.log('Configuration loaded successfully');

    // Gemini クライアントを初期化
    const geminiClient = new GeminiClient(config.geminiApiKey);
    
    // API キーの有効性を確認
    const isValidKey = await geminiClient.validateApiKey();
    if (!isValidKey) {
      throw new Error('Invalid Gemini API key');
    }
    console.log('Gemini API key validated');

    // ニュースレポートを生成
    console.log('Generating news report...');
    const newsReport = await geminiClient.generateNewsReport();
    console.log(`News report generated with ${newsReport.totalCount} articles`);

    // レポートをS3に保存（Slack Sender Lambda が後で読み取る）
    const reportKey = `reports/${newsReport.date}.json`;
    await s3.putObject({
      Bucket: BUCKET_NAME,
      Key: reportKey,
      Body: JSON.stringify(newsReport, null, 2),
      ContentType: 'application/json'
    }).promise();

    console.log(`Report saved to S3: ${reportKey}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'News collection completed successfully',
        reportDate: newsReport.date,
        articleCount: newsReport.totalCount,
        s3Key: reportKey
      })
    };

  } catch (error) {
    console.error('Error in news collector:', error);
    
    // エラーの詳細をCloudWatch Logsに記録
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'News collection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};