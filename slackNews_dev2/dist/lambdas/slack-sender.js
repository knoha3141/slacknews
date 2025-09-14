"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const slack_client_1 = require("../clients/slack-client");
const aws_config_1 = require("../utils/aws-config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Client = new client_s3_1.S3Client({ region: 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME || 'slacknews-reports-390403878175';
const handler = async (event, context) => {
    console.log('Slack Sender Lambda started');
    console.log('Event:', JSON.stringify(event, null, 2));
    try {
        // 設定を読み込み
        const config = await (0, aws_config_1.loadConfig)();
        console.log('Configuration loaded successfully');
        // 今日の日付でレポートファイルを検索
        const today = new Date().toISOString().split('T')[0];
        const reportKey = `reports/${today}.json`;
        console.log(`Looking for report: ${reportKey}`);
        // S3からレポートを取得
        let newsReport;
        try {
            const getCommand = new client_s3_1.GetObjectCommand({
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
        }
        catch (s3Error) {
            console.error('Failed to load report from S3:', s3Error);
            // フォールバック: 昨日のレポートを試す
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = `reports/${yesterday.toISOString().split('T')[0]}.json`;
            console.log(`Trying fallback report: ${yesterdayKey}`);
            const fallbackCommand = new client_s3_1.GetObjectCommand({
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
        const slackClient = new slack_client_1.SlackClient(config.slackToken);
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
    }
    catch (error) {
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
exports.handler = handler;
