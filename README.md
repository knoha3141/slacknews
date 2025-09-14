# SlackNews 🚀

毎日朝8:00にGeminiが夜間調査した最新ニュースレポートを自動でSlackに送信するシステム

## 概要

SlackNewsは起業家向けに、テック・ビジネス・経済分野の重要なニュースを自動収集し、Slackチャンネルに配信するAIパワードなニュースアグリゲーターです。

### 主な機能

- 🤖 **Gemini AI によるニュース分析**: 最新ニュースの自動収集・要約・重要度評価
- 📅 **自動スケジュール配信**: 夜間収集(23:00) → 朝配信(8:00)
- 💼 **起業家フォーカス**: テック・ビジネス・経済分野に特化
- 📱 **Slack統合**: リッチなメッセージ形式での配信
- ☁️ **AWS サーバーレス**: Lambda + EventBridge でコスト効率的

## アーキテクチャ

```
GitHub → AWS Lambda Functions → Slack
         ↗️                 ↘️
EventBridge          Parameter Store
(スケジューラー)      (設定管理)
         ↖️                 ↙️
       S3 Bucket    CloudWatch Logs
     (レポート保存)    (ログ・監視)
```

## セットアップ

### 前提条件

- AWS CLI の設定
- Node.js 18+ 
- TypeScript
- Slack Bot Token
- Gemini API Key

### 1. プロジェクトのセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/knoha3141/slacknews.git
cd slacknews

# 依存関係をインストール
npm install
```

### 2. AWS Parameter Store に設定を保存

```bash
# 対話形式で設定を入力
./scripts/setup-parameters.sh
```

### 3. AWSインフラをデプロイ

```bash
# 全体をデプロイ
./scripts/deploy.sh
```

## 設定項目

### 必要なSlack設定

1. **Slack Bot作成**:
   - https://api.slack.com/apps でアプリを作成
   - Bot Token Scopes: `chat:write`, `channels:read`
   
2. **チャンネル設定**:
   - 配信先チャンネルにBotを追加
   - チャンネルIDを取得 (C0XXXXXXXXX形式)

### 必要なGemini設定

1. **API Key取得**:
   - https://makersuite.google.com/app/apikey でAPIキーを生成
   - 無料枠内での使用を推奨

## 使用方法

### 自動実行

- **夜間収集**: 毎日23:00(JST)に自動実行
- **朝配信**: 毎日08:00(JST)に自動実行

### 手動実行

```bash
# ニュース収集をテスト
aws lambda invoke --function-name slacknews-news-collector output.json

# Slack送信をテスト  
aws lambda invoke --function-name slacknews-slack-sender output.json
```

### ログ確認

```bash
# News Collector のログ
aws logs tail /aws/lambda/slacknews-news-collector --follow

# Slack Sender のログ
aws logs tail /aws/lambda/slacknews-slack-sender --follow
```

## 開発

### ローカル開発

```bash
# TypeScript コンパイル
npm run build

# テスト実行 (TODO: テスト追加予定)
npm test
```

### デプロイメント

```bash
# 全体の再デプロイ
./scripts/deploy.sh

# Lambda関数のみ更新
npm run deploy:news-collector
npm run deploy:slack-sender
```

## カスタマイズ

### ニュースソース変更

`src/clients/gemini-client.ts` のプロンプトを編集:

```typescript
const prompt = `
// カスタムプロンプトをここに記述
`;
```

### Slackメッセージ形式変更

`src/clients/slack-client.ts` の `formatNewsReport` メソッドを編集

### スケジュール変更

`cloudformation/slacknews-infrastructure.yaml` のcron式を編集:

```yaml
ScheduleExpression: 'cron(0 14 * * ? *)'  # UTC時間で指定
```

## 料金

### Gemini API (無料枠)
- 月間15 RPM (Request Per Minute)
- 1日2回の実行で十分収まる

### AWS (無料枠内)
- Lambda: 月間100万リクエスト + 40万GB秒
- EventBridge: 月間1400万イベント
- S3: 5GB + 20,000 GET/PUT リクエスト

## トラブルシューティング

### よくある問題

1. **Gemini API制限エラー**:
   - Parameter Store のAPIキーを確認
   - 無料枠の制限を確認

2. **Slack送信失敗**:
   - Bot TokenのScopeを確認
   - チャンネルにBotが追加されているか確認

3. **Lambda タイムアウト**:
   - CloudFormation で Timeout を調整

### ログの確認方法

```bash
# 直近のエラーログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/slacknews-news-collector \
  --filter-pattern ERROR
```

## ライセンス

MIT License

## サポート

Issue や質問は [GitHub Issues](https://github.com/knoha3141/slacknews/issues) へお願いします。