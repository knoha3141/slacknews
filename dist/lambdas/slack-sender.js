"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const slack_client_1 = require("../clients/slack-client");
const aws_config_1 = require("../utils/aws-config");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const s3 = new aws_sdk_1.default.S3();
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
            const s3Object = await s3.getObject({
                Bucket: BUCKET_NAME,
                Key: reportKey
            }).promise();
            if (!s3Object.Body) {
                throw new Error('Report file is empty');
            }
            newsReport = JSON.parse(s3Object.Body.toString());
            console.log(`Report loaded: ${newsReport.totalCount} articles`);
        }
        catch (s3Error) {
            console.error('Failed to load report from S3:', s3Error);
            // フォールバック: 昨日のレポートを試す
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = `reports/${yesterday.toISOString().split('T')[0]}.json`;
            console.log(`Trying fallback report: ${yesterdayKey}`);
            const fallbackObject = await s3.getObject({
                Bucket: BUCKET_NAME,
                Key: yesterdayKey
            }).promise();
            if (!fallbackObject.Body) {
                throw new Error('Fallback report file is empty');
            }
            newsReport = JSON.parse(fallbackObject.Body.toString());
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
