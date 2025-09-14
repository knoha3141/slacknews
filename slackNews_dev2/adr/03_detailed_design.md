# SlackNews 詳細設計仕様書

## 概要
SlackNews システムの実装レベルでの詳細設計を定義。各コンポーネントの具体的な処理フロー、データ構造、API仕様を詳述。

## システム全体フロー

### 実行シーケンス
```
1. CloudWatch Events → news-collector Lambda (夜間実行)
2. news-collector → Gemini API → JSON形式ニュース生成
3. news-collector → S3 Bucket → レポート保存
4. CloudWatch Events → slack-sender Lambda (朝実行)
5. slack-sender → S3 Bucket → レポート読み込み
6. slack-sender → Slack API → Block Kit形式で配信
```

## 詳細コンポーネント設計

### 1. 設定管理モジュール (`utils/aws-config.ts`)

#### 1.1 設定データ構造
```typescript
interface AppConfig {
  geminiApiKey: string;      // Gemini API認証キー
  slackToken: string;        // Slack Bot OAuth Token  
  slackChannelId: string;    // 配信先Slackチャンネル
}
```

#### 1.2 loadConfig() 処理フロー
```typescript
async function loadConfig(): Promise<AppConfig> {
  // Phase 1: SSMクライアント初期化
  const ssm = new AWS.SSM({ region: 'us-east-1' });
  
  // Phase 2: パラメータ一括取得
  const params = {
    Names: [
      '/slacknews/gemini-api-key',    // KMS暗号化
      '/slacknews/slack-token',       // KMS暗号化
      '/slacknews/slack-channel-id'   // 平文可
    ],
    WithDecryption: true // 自動復号化
  };
  
  // Phase 3: 取得・検証・マッピング
  const result = await ssm.getParameters(params).promise();
  // 必須パラメータ存在確認
  // 設定オブジェクト構築
  // 返却
}
```

#### 1.3 セキュリティ仕様
- **暗号化**: AWS KMS Customer Managed Key
- **権限**: Lambda実行ロールでのssm:GetParameters権限
- **監査**: CloudTrail でのアクセス記録

### 2. Gemini API クライアント (`clients/gemini-client.ts`)

#### 2.1 データ構造
```typescript
interface NewsArticle {
  title: string;           // 日本語記事タイトル
  summary: string;         // 200文字要約
  sourceUrl: string;       // ソースURL (デフォルト: TechCrunch)
  category: 'tech' | 'business' | 'economy';
  importance: number;      // 1-5の重要度
}

interface NewsReport {
  date: string;           // YYYY-MM-DD形式
  articles: NewsArticle[];
  totalCount: number;     // 記事総数
  generatedAt: string;    // ISO 8601タイムスタンプ
}
```

#### 2.2 generateNewsReport() 処理フロー
```typescript
async generateNewsReport(): Promise<NewsReport> {
  // 1. プロンプト送信
  const prompt = "起業家向けニュース3件をJSON形式で生成";
  const result = await this.model.generateContent(prompt);
  
  // 2. レスポンス整形
  let jsonString = response.text()
    .replace(/```json|```/g, '')     // マークダウン除去
    .replace(/\/\/.*$/gm, '')        // コメント除去
    .replace(/\s+/g, ' ')            // 空白統一
    .trim();
  
  // 3. JSON解析 (失敗時は自動修復)
  try {
    return JSON.parse(jsonString);
  } catch (parseError) {
    // "title"キーで記事境界を検出し部分的に抽出
    const repairedArticles = this.extractValidArticles(jsonString);
    return this.buildNewsReport(repairedArticles);
  }
}
```

#### 2.3 validateApiKey() 処理
**目的**: Gemini APIキーの有効性を事前確認

```typescript
async validateApiKey(): Promise<boolean> {
  try {
    await this.model.generateContent('Hello');
    return true;  // APIキー有効
  } catch (error) {
    return false; // APIキー無効/接続問題
  }
}
```

**機能**:
- 最小限テストプロンプト(`'Hello'`)でAPI接続確認
- 重いニュース生成処理前の早期エラー検出
- 無効APIキー/期限切れ/権限不足/接続問題を検出
- Lambda関数で認証問題と他エラーの区別に使用

### 3. Slack API クライアント (`clients/slack-client.ts`)

#### 3.1 sendNewsReport() 処理フロー
```typescript
async sendNewsReport(channelId: string, report: NewsReport): Promise<boolean> {
  // Phase 1: Block Kit UI構築
  const formattedBlocks = this.formatNewsReport(report);
  
  // Phase 2: Slack API呼び出し
  const result = await this.client.chat.postMessage({
    channel: channelId,
    text: '📰 今日のスタートアップニュース', // fallback text
    blocks: formattedBlocks
  });
  
  return result.ok || false;
}
```

#### 3.2 formatNewsReport() Block Kit 構築

##### Header Section
```typescript
blocks.push({
  type: 'header',
  text: {
    type: 'plain_text',
    text: '📰 今日のスタートアップニュース'
  }
});
```

##### Context Section
```typescript
blocks.push({
  type: 'context',
  elements: [{
    type: 'mrkdwn',
    text: `📅 ${report.date} | 📊 ${report.totalCount}件のニュース | 🕐 生成時刻: ${localeTime}`
  }]
});
```

##### Article Sections
```typescript
// カテゴリー別整理
const categorizedNews = {
  tech: report.articles.filter(a => a.category === 'tech'),
  business: report.articles.filter(a => a.category === 'business'),
  economy: report.articles.filter(a => a.category === 'economy')
};

// カテゴリーヘッダー + 記事詳細
articles.forEach((article, index) => {
  const importanceStars = '★'.repeat(article.importance) + '☆'.repeat(5 - article.importance);
  
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${article.title}*\n${importanceStars} (重要度: ${article.importance}/5)\n\n${article.summary}`
    },
    accessory: {
      type: 'button',
      text: { type: 'plain_text', text: '記事を読む' },
      url: article.sourceUrl,
      action_id: `read_article_${index}`
    }
  });
});
```

#### 3.3 testConnection() 処理
```typescript
async testConnection(): Promise<boolean> {
  try {
    const result = await this.client.auth.test();
    return result.ok || false;
  } catch (error) {
    console.error('Slack connection test failed:', error);
    return false;
  }
}
```

### 4. ニュース収集 Lambda (`lambdas/news-collector.ts`)

#### 4.1 Lambda Handler 実装
```typescript
export const handler: Handler<ScheduledEvent> = async (event, context) => {
  console.log('News Collector Lambda started');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Phase 1: 設定読み込み
    const config = await loadConfig();
    console.log('Configuration loaded successfully');

    // Phase 2: Gemini クライアント初期化・検証
    const geminiClient = new GeminiClient(config.geminiApiKey);
    const isValidKey = await geminiClient.validateApiKey();
    if (!isValidKey) {
      throw new Error('Invalid Gemini API key');
    }

    // Phase 3: ニュースレポート生成
    console.log('Generating news report...');
    const newsReport = await geminiClient.generateNewsReport();
    console.log(`News report generated with ${newsReport.totalCount} articles`);

    // Phase 4: S3保存
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
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'News collection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
```

#### 4.2 環境変数
```typescript
const BUCKET_NAME = process.env.BUCKET_NAME || 'slacknews-reports-390403878175';
```

### 5. Slack送信 Lambda (`lambdas/slack-sender.ts`)

#### 5.1 Lambda Handler 実装
```typescript
export const handler: Handler<ScheduledEvent> = async (event, context) => {
  console.log('Slack Sender Lambda started');

  try {
    // Phase 1: 設定読み込み
    const config = await loadConfig();
    console.log('Configuration loaded successfully');

    // Phase 2: S3レポート取得 (フォールバック機能付き)
    const today = new Date().toISOString().split('T')[0];
    const reportKey = `reports/${today}.json`;

    let newsReport: NewsReport;
    try {
      // 今日のレポートを取得
      const s3Object = await s3.getObject({
        Bucket: BUCKET_NAME,
        Key: reportKey
      }).promise();

      if (!s3Object.Body) {
        throw new Error('Report file is empty');
      }

      newsReport = JSON.parse(s3Object.Body.toString());
      console.log(`Report loaded: ${newsReport.totalCount} articles`);
    } catch (s3Error) {
      console.error('Failed to load report from S3:', s3Error);
      
      // フォールバック: 昨日のレポートを試行
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

    // Phase 3: Slack送信
    const slackClient = new SlackClient(config.slackToken);
    
    const isConnected = await slackClient.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to Slack');
    }

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
```

#### 5.2 フォールバック機能詳細
- **Primary**: 当日のレポートファイル取得
- **Fallback**: 前日のレポートファイル取得
- **Error Handling**: 両方失敗時はエラー返却

## データフロー詳細

### 1. ニュース収集フロー
```
CloudWatch Events (Trigger)
  ↓
news-collector Lambda
  ↓
loadConfig() → AWS Systems Manager Parameter Store
  ↓  
GeminiClient.validateApiKey() → Gemini API
  ↓
GeminiClient.generateNewsReport() → Gemini API
  ↓
JSON修復・構造化
  ↓
S3 putObject() → S3 Bucket (reports/YYYY-MM-DD.json)
```

### 2. Slack配信フロー  
```
CloudWatch Events (Trigger)
  ↓
slack-sender Lambda
  ↓
loadConfig() → AWS Systems Manager Parameter Store
  ↓
S3 getObject() → S3 Bucket (reports/YYYY-MM-DD.json)
  ↓ (失敗時)
S3 getObject() → S3 Bucket (reports/昨日.json) [フォールバック]
  ↓
SlackClient.testConnection() → Slack API
  ↓
SlackClient.sendNewsReport() → Block Kit形式変換
  ↓
Slack Web API (chat.postMessage)
```

## エラーハンドリング仕様

### 1. API レベル
- **Gemini API**: 接続失敗、レート制限、無効レスポンス
- **Slack API**: 接続失敗、チャンネル権限、メッセージ制限
- **AWS API**: Parameter Store, S3アクセス権限

### 2. データレベル
- **JSON Parse**: 自動修復アルゴリズム
- **記事構造**: 必須フィールド検証
- **URL修正**: デフォルトURL補完

### 3. システムレベル
- **Lambda実行**: タイムアウト、メモリ不足
- **ネットワーク**: 接続断、DNS解決失敗

## セキュリティ実装

### 1. 認証情報管理
```typescript
// AWS Systems Manager Parameter Store
/slacknews/gemini-api-key     (SecureString, KMS暗号化)
/slacknews/slack-token        (SecureString, KMS暗号化)  
/slacknews/slack-channel-id   (String, 平文可)
```

### 2. IAM ロール設計
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:*:*:parameter/slacknews/*"
    },
    {
      "Effect": "Allow", 
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::slacknews-reports-*/*"
    }
  ]
}
```

### 3. ログセキュリティ
```typescript
// 機密情報のマスキング
console.log('API key validated'); // ❌ APIキー値は出力しない
console.log('Configuration loaded successfully'); // ✅ 抽象的なメッセージ
```

## 監視・ログ設計

### 1. 構造化ログ
```typescript
// 成功ログ
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'INFO',
  component: 'news-collector',
  event: 'report_generated',
  data: {
    articleCount: newsReport.totalCount,
    reportDate: newsReport.date,
    s3Key: reportKey
  }
}));

// エラーログ
console.error(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'ERROR', 
  component: 'slack-sender',
  event: 'slack_send_failed',
  error: error.message,
  data: {
    channelId: config.slackChannelId,
    reportDate: newsReport.date
  }
}));
```

### 2. CloudWatch メトリクス
- **Lambda実行時間**: 各関数の処理時間
- **エラー率**: 失敗/成功の比率
- **API呼び出し数**: Gemini/Slack APIの使用量

### 3. アラート設計
```typescript
// CloudWatch アラーム対象
- Lambda関数のエラー率 > 10%
- Lambda関数の実行時間 > 5分
- S3アクセス失敗率 > 5%
```

## パフォーマンス仕様

### 1. 実行時間目標
- **news-collector**: < 3分 (Gemini API依存)
- **slack-sender**: < 30秒 (S3読み込み + Slack送信)

### 2. メモリ使用量
- **news-collector**: 256MB (JSON処理バッファ)
- **slack-sender**: 128MB (軽量処理)

### 3. 同時実行制限
- **Reserved Concurrency**: 1 (スケジュール実行のため)

## 実装完了チェックリスト

### Core Components
- [x] AWS Systems Manager Parameter Store設定管理
- [x] Gemini API クライアント実装
- [x] 高度なJSON修復アルゴリズム
- [x] Slack Block Kit メッセージフォーマッター
- [x] news-collector Lambda関数
- [x] slack-sender Lambda関数

### Error Handling
- [x] API接続失敗対応
- [x] JSON parse失敗時の自動修復
- [x] S3アクセス失敗時のフォールバック
- [x] 構造化エラーログ出力

### Security
- [x] Parameter Store暗号化設定
- [x] IAMロール最小権限設定
- [x] 機密情報ログ出力回避

### Integration
- [x] CloudWatch Events スケジュール設定
- [x] S3バケット設定
- [x] Lambda環境変数設定