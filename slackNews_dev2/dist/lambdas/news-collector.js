"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const gemini_client_1 = require("../clients/gemini-client");
const aws_config_1 = require("../utils/aws-config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Client = new client_s3_1.S3Client({ region: 'us-east-1' });
const BUCKET_NAME = process.env.BUCKET_NAME || 'slacknews-reports-390403878175';
const handler = async (event, context) => {
    console.log('News Collector Lambda started');
    console.log('Event:', JSON.stringify(event, null, 2));
    try {
        // 設定を読み込み
        const config = await (0, aws_config_1.loadConfig)();
        console.log('Configuration loaded successfully');
        // Gemini クライアントを初期化
        const geminiClient = new gemini_client_1.GeminiClient(config.geminiApiKey);
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
        const putCommand = new client_s3_1.PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: reportKey,
            Body: JSON.stringify(newsReport, null, 2),
            ContentType: 'application/json'
        });
        await s3Client.send(putCommand);
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
    }
    catch (error) {
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
exports.handler = handler;
