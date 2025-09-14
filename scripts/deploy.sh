#!/bin/bash

# SlackNews Deployment Script
# このスクリプトはSlackNewsシステム全体をAWSにデプロイします

set -e  # エラー時に実行を停止

PROJECT_NAME="slacknews"
STACK_NAME="$PROJECT_NAME-infrastructure"
REGION="us-east-1"

echo "🚀 SlackNews Deployment Script"
echo "=============================="
echo "Project: $PROJECT_NAME"
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo ""

# 前提条件の確認
echo "📋 前提条件を確認中..."

# AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI が見つかりません"
    exit 1
fi

# Node.js
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm が見つかりません"
    exit 1
fi

# TypeScript
if ! command -v tsc &> /dev/null; then
    echo "❌ TypeScript が見つかりません。npm install -g typescript を実行してください"
    exit 1
fi

echo "✅ すべての前提条件が満たされています"

# AWS認証確認
echo ""
echo "🔐 AWS認証を確認中..."
if ! aws sts get-caller-identity --region $REGION &> /dev/null; then
    echo "❌ AWS認証が設定されていません"
    echo "aws configure を実行してください"
    exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account: $AWS_ACCOUNT_ID"

# 依存関係のインストール
echo ""
echo "📦 依存関係をインストール中..."
npm install

# TypeScriptコンパイル
echo ""
echo "🔨 TypeScriptをコンパイル中..."
npm run build

# Lambda関数のパッケージング
echo ""
echo "📁 Lambda関数をパッケージ中..."

# 一時的なディレクトリ作成
mkdir -p dist/packages

# News Collector Lambda
echo "  - News Collector Lambda"
cd dist
cp -r ../node_modules .
zip -r packages/news-collector.zip lambdas/news-collector.js clients/ utils/ node_modules/
cd ..

# Slack Sender Lambda
echo "  - Slack Sender Lambda"
cd dist
zip -r packages/slack-sender.zip lambdas/slack-sender.js clients/ utils/ node_modules/
cd ..

echo "✅ Lambda関数のパッケージングが完了しました"

# CloudFormation スタックのデプロイ
echo ""
echo "☁️  CloudFormation スタックをデプロイ中..."

aws cloudformation deploy \
    --template-file cloudformation/slacknews-infrastructure.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides ProjectName=$PROJECT_NAME \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

if [ $? -eq 0 ]; then
    echo "✅ CloudFormation スタックのデプロイが完了しました"
else
    echo "❌ CloudFormation スタックのデプロイに失敗しました"
    exit 1
fi

# S3バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`ReportsBucketName`].OutputValue' \
    --output text \
    --region $REGION)

echo "📊 S3 Bucket: $BUCKET_NAME"

# Lambda関数のコード更新
echo ""
echo "🔄 Lambda関数のコードを更新中..."

# News Collector Lambda の更新
echo "  - News Collector Lambda"
aws lambda update-function-code \
    --function-name "$PROJECT_NAME-news-collector" \
    --zip-file fileb://dist/packages/news-collector.zip \
    --region $REGION

# 環境変数の更新
aws lambda update-function-configuration \
    --function-name "$PROJECT_NAME-news-collector" \
    --environment Variables="{BUCKET_NAME=$BUCKET_NAME}" \
    --region $REGION

# Slack Sender Lambda の更新
echo "  - Slack Sender Lambda"
aws lambda update-function-code \
    --function-name "$PROJECT_NAME-slack-sender" \
    --zip-file fileb://dist/packages/slack-sender.zip \
    --region $REGION

aws lambda update-function-configuration \
    --function-name "$PROJECT_NAME-slack-sender" \
    --environment Variables="{BUCKET_NAME=$BUCKET_NAME}" \
    --region $REGION

echo "✅ Lambda関数の更新が完了しました"

# デプロイ完了
echo ""
echo "🎉 デプロイが正常に完了しました！"
echo ""
echo "📝 デプロイされたリソース:"
echo "- CloudFormation Stack: $STACK_NAME"
echo "- S3 Bucket: $BUCKET_NAME"
echo "- Lambda Functions:"
echo "  - $PROJECT_NAME-news-collector (23:00 JST 実行)"
echo "  - $PROJECT_NAME-slack-sender (08:00 JST 実行)"
echo ""
echo "📋 次のステップ:"
echo "1. AWS Parameter Store に必要な設定を追加:"
echo "   ./scripts/setup-parameters.sh"
echo ""
echo "2. 初回テスト実行:"
echo "   aws lambda invoke --function-name $PROJECT_NAME-news-collector output.json"
echo "   aws lambda invoke --function-name $PROJECT_NAME-slack-sender output.json"
echo ""
echo "🔍 ログの確認:"
echo "   aws logs tail /aws/lambda/$PROJECT_NAME-news-collector --follow"
echo "   aws logs tail /aws/lambda/$PROJECT_NAME-slack-sender --follow"

# クリーンアップ
echo ""
echo "🧹 一時ファイルをクリーンアップ中..."
rm -rf dist/packages
rm -rf dist/node_modules

echo "✅ デプロイスクリプトが完了しました"