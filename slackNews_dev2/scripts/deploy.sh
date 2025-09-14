#!/bin/bash

# --- 設定 ---
# スクリプト内でエラーが発生した場合、即座に終了する
set -e

# Lambda関数名
COLLECTOR_FUNCTION_NAME="slacknews-news-collector"
SENDER_FUNCTION_NAME="slacknews-slack-sender"

# AWSリージョン
REGION="us-east-1"

# ビルド用ディレクトリとZIPファイル名
BUILD_DIR="dist"
ZIP_FILE="deployment.zip"


# --- スクリプト本体 ---
echo "🚀 SlackNewsのデプロイを開始します..."

# 1. 前回のビルド成果物をクリーンアップ
echo "[1/5] 古いビルド成果物をクリーンアップ中..."
rm -rf "$BUILD_DIR" "$ZIP_FILE"
echo "✅ クリーンアップが完了しました。"

# 2. TypeScriptをコンパイル
echo "[2/5] TypeScriptのコンパイル中..."
npx tsc
echo "✅ コンパイルが完了し、'$BUILD_DIR'ディレクトリが作成されました。"

# 3. 本番環境用のライブラリをビルドディレクトリにインストール
echo "[3/5] 本番環境用のライブラリを'$BUILD_DIR'にインストール中..."
cp package.json package-lock.json "$BUILD_DIR/"
cd "$BUILD_DIR"
npm install --omit=dev
cd ..
echo "✅ ライブラリのインストールが完了しました。"

# 4. デプロイパッケージをZIP形式で圧縮
echo "[4/5] '$BUILD_DIR'ディレクトリをZIPファイルに圧縮中..."
cd "$BUILD_DIR"
zip -r "../$ZIP_FILE" . > /dev/null # zipの進捗表示を抑制
cd ..
echo "✅ パッケージの圧縮が完了しました: $ZIP_FILE"

# 5. AWS Lambdaに関数をデプロイ
echo "[5/5] AWS Lambdaへのデプロイ中..."

echo "  -> ターゲット: $COLLECTOR_FUNCTION_NAME"
aws lambda update-function-code \
  --function-name "$COLLECTOR_FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_FILE" \
  --region "$REGION" \
  --output text > /dev/null # AWS CLIの出力を抑制

echo "  -> ターゲット: $SENDER_FUNCTION_NAME"
aws lambda update-function-code \
  --function-name "$SENDER_FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_FILE" \
  --region "$REGION" \
  --output text > /dev/null # AWS CLIの出力を抑制

echo "✅ Lambda関数の更新が完了しました。"

# 6. 後片付け (ZIPファイルのみ削除)
echo "🧹 一時ファイル ($ZIP_FILE) をクリーンアップ中..."
rm "$ZIP_FILE"
echo "✅ クリーンアップが完了しました。"

echo ""
echo "🎉 デプロイが正常に完了しました！ 🚀"
