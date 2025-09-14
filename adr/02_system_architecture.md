# システム設計・アーキテクチャ設計書

## 概要
SlackNews システムの技術設計とアーキテクチャを定義

## システム全体構成

### シンプル AWS 構成
```
SlackNews System (最小構成)
├── GitHub Repository (コード管理)
├── AWS Lambda Functions (2つのみ)
│   ├── News Collector (夜間実行)
│   └── Slack Sender (朝配信)
├── Amazon EventBridge (スケジューラー)
│   ├── 夜間トリガー (23:00)
│   └── 朝トリガー (08:00)
├── AWS Systems Manager Parameter Store
│   ├── Gemini API Key
│   ├── Slack API Token
│   └── Slack Channel ID
└── Amazon CloudWatch (基本ログのみ)
```

## コンポーネント設計

### 1. News Collector Module
**責務**: 夜間にニュース収集・分析・レポート生成

#### 1.1 Gemini API Client
- [ ] Gemini API との通信処理
- [ ] レート制限・エラーハンドリング
- [ ] API認証管理

#### 1.2 News Analysis Engine
- [ ] ニュースソースからの情報収集指示
- [ ] カテゴリー分類（テック/ビジネス/経済）
- [ ] 起業への影響度評価
- [ ] 重要度に基づくフィルタリング

#### 1.3 Report Generator
- [ ] 構造化レポートの生成
- [ ] Slack用フォーマット変換
- [ ] レポート保存処理

### 2. Scheduler Service
**責務**: バッチ処理とSlack送信のスケジュール管理

#### 2.1 Cron Job Manager
- [ ] 夜間バッチ実行（23:00）
- [ ] 朝の配信実行（08:00）
- [ ] 実行結果監視

#### 2.2 Task Queue
- [ ] 非同期処理管理
- [ ] リトライ機能
- [ ] エラー処理

### 3. Slack Integration Module
**責務**: Slackとの連携処理

#### 3.1 Slack API Client
- [ ] Slack Web API通信
- [ ] チャンネル送信処理
- [ ] 認証トークン管理

#### 3.2 Message Formatter
- [ ] レポートのSlack形式変換
- [ ] マークダウン整形
- [ ] 文字数制限対応

### 4. Data Layer
**責務**: データ永続化とアプリケーション設定

#### 4.1 Report Storage
- [ ] 生成レポートの保存
- [ ] 送信履歴管理
- [ ] データ保持期間管理

#### 4.2 Configuration Management
- [ ] API設定管理
- [ ] スケジュール設定
- [ ] ニュースソース設定

## 技術スタック

### 実行環境
- [ ] **AWS** (クラウドインフラ)
- [ ] **Node.js** (JavaScript/TypeScript)
- [ ] **AWS Lambda** (サーバーレス実行環境)

### 外部API
- [ ] **Google Gemini API** (ニュース分析) - 無料枠内で運用
- [ ] **Slack Web API** (メッセージ送信)

### 最小構成
- [ ] **AWS Lambda** (2つの関数のみ)
- [ ] **Amazon EventBridge** (スケジュール管理)
- [ ] **AWS Systems Manager Parameter Store** (設定管理)
- [ ] **Amazon CloudWatch** (基本ログ)
- [ ] **GitHub** (コード管理・手動デプロイ)

## API設計

### 内部API構造
```typescript
// Gemini Client
interface GeminiClient {
  analyzeNews(prompt: string): Promise<NewsReport>
  validateApiKey(): Promise<boolean>
}

// Report Structure
interface NewsReport {
  date: string
  categories: NewsCategory[]
  totalCount: number
  generatedAt: string
}

interface NewsCategory {
  type: 'tech' | 'business' | 'economy'
  articles: NewsArticle[]
}

interface NewsArticle {
  title: string
  summary: string // 500文字以上
  sourceUrl: string
  importance: number // 1-5
  category: string
}
```

## データフロー

### 夜間バッチフロー (23:00)
1. News Collector 起動
2. Gemini API でニュース収集・分析
3. レポート生成・保存
4. エラーログ記録

### 朝の配信フロー (08:00)
1. Scheduler 起動
2. 保存済みレポート取得
3. Slack形式に変換
4. Slackチャンネル送信
5. 送信結果ログ記録

## セキュリティ設計

### API認証
- [ ] 環境変数でのAPIキー管理
- [ ] トークンの暗号化保存
- [ ] API呼び出し制限

### データ保護
- [ ] 機密情報のログ出力禁止
- [ ] 通信の HTTPS 必須
- [ ] 定期的な認証情報ローテーション

## エラーハンドリング

### API制限対応
- [ ] レート制限検知・待機
- [ ] 指数バックオフでのリトライ
- [ ] フォールバック処理

### 障害時対応
- [ ] ヘルスチェック機能
- [ ] 自動復旧処理
- [ ] アラート通知

## 監視・ログ

### ログ設計
- [ ] 構造化ログ (JSON)
- [ ] ログレベル管理
- [ ] ローテーション設定

### 監視項目
- [ ] API呼び出し成功率
- [ ] レポート生成成功率
- [ ] Slack送信成功率
- [ ] 処理時間監視