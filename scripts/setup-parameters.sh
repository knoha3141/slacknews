#!/bin/bash

# SlackNews AWS Parameter Store Setup Script
# このスクリプトは必要なパラメータをAWS Parameter Storeに設定します

echo "🚀 SlackNews Parameter Store Setup"
echo "=================================="

# AWS CLIの確認
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI が見つかりません。AWS CLI をインストールしてください。"
    exit 1
fi

# AWS認証の確認
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS認証が設定されていません。'aws configure' を実行してください。"
    exit 1
fi

echo "✅ AWS CLI が設定されています"

# パラメータの入力を求める
echo ""
echo "📝 必要な情報を入力してください:"
echo ""

# Gemini API Key
read -s -p "🤖 Gemini API Key: " GEMINI_API_KEY
echo ""

# Slack Bot Token
read -s -p "🔗 Slack Bot Token (xoxb-で始まる): " SLACK_TOKEN
echo ""

# Slack Channel ID
read -p "📺 Slack Channel ID (C0XXXXXXXXX): " SLACK_CHANNEL_ID
echo ""

# パラメータの検証
if [[ -z "$GEMINI_API_KEY" || -z "$SLACK_TOKEN" || -z "$SLACK_CHANNEL_ID" ]]; then
    echo "❌ すべての項目を入力してください。"
    exit 1
fi

if [[ ! "$SLACK_TOKEN" =~ ^xoxb- ]]; then
    echo "❌ Slack Bot Tokenが正しい形式ではありません (xoxb-で始まる必要があります)"
    exit 1
fi

if [[ ! "$SLACK_CHANNEL_ID" =~ ^C[0-9A-Z]+$ ]]; then
    echo "❌ Slack Channel IDが正しい形式ではありません (Cで始まる必要があります)"
    exit 1
fi

echo "📡 AWS Parameter Store にパラメータを保存中..."

# Gemini API Key を保存
aws ssm put-parameter \
    --name "/slacknews/gemini-api-key" \
    --value "$GEMINI_API_KEY" \
    --type "SecureString" \
    --description "Gemini API Key for SlackNews" \
    --overwrite

if [ $? -eq 0 ]; then
    echo "✅ Gemini API Key を保存しました"
else
    echo "❌ Gemini API Key の保存に失敗しました"
    exit 1
fi

# Slack Bot Token を保存
aws ssm put-parameter \
    --name "/slacknews/slack-token" \
    --value "$SLACK_TOKEN" \
    --type "SecureString" \
    --description "Slack Bot Token for SlackNews" \
    --overwrite

if [ $? -eq 0 ]; then
    echo "✅ Slack Bot Token を保存しました"
else
    echo "❌ Slack Bot Token の保存に失敗しました"
    exit 1
fi

# Slack Channel ID を保存
aws ssm put-parameter \
    --name "/slacknews/slack-channel-id" \
    --value "$SLACK_CHANNEL_ID" \
    --type "String" \
    --description "Slack Channel ID for SlackNews" \
    --overwrite

if [ $? -eq 0 ]; then
    echo "✅ Slack Channel ID を保存しました"
else
    echo "❌ Slack Channel ID の保存に失敗しました"
    exit 1
fi

echo ""
echo "🎉 すべてのパラメータが正常に保存されました！"
echo ""
echo "保存されたパラメータ:"
echo "- /slacknews/gemini-api-key (SecureString)"
echo "- /slacknews/slack-token (SecureString)"
echo "- /slacknews/slack-channel-id (String)"
echo ""
echo "次のステップ: CloudFormationテンプレートをデプロイしてください"