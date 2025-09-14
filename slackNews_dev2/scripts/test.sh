#!/bin/bash

# --- 設定 ---
# エラーが発生した場合、即座に終了する
set -e

# Lambda関数名とAWSリージョン
COLLECTOR_FUNCTION_NAME="slacknews-news-collector"
SENDER_FUNCTION_NAME="slacknews-slack-sender"
REGION="us-east-1"

# テスト結果の出力ファイル名
COLLECTOR_OUTPUT_FILE="test-output-collector.json"
SENDER_OUTPUT_FILE="test-output-sender.json"

# --- スクリプト本体 ---
echo "🧪 SlackNewsの実行テストを開始します..."

# 1. 古い出力ファイルを削除
rm -f "$COLLECTOR_OUTPUT_FILE" "$SENDER_OUTPUT_FILE"

# 2. news-collector Lambda関数を実行
echo "[1/2] ニュース収集関数 ($COLLECTOR_FUNCTION_NAME) を実行中..."
aws lambda invoke \
  --function-name "$COLLECTOR_FUNCTION_NAME" \
  --region "$REGION" \
  "$COLLECTOR_OUTPUT_FILE" > /dev/null # AWS CLIの標準出力を抑制

echo "✅ 実行完了。結果を $COLLECTOR_OUTPUT_FILE に保存しました。"

# 3. テスト結果を簡易チェック (jqコマンドが必要)
if command -v jq &> /dev/null
then
    echo "  -> レスポンスをチェック中..."
    # レスポンスボディ(文字列)をJSONとして解釈し、articleCountを取得
    ARTICLE_COUNT=$(jq '.body | fromjson | .articleCount' "$COLLECTOR_OUTPUT_FILE")

    if [[ "$ARTICLE_COUNT" -gt 0 ]]; then
        echo "  👍 成功: $ARTICLE_COUNT 件の記事が生成されました。"
    else
        echo "  ⚠️ 警告: 記事数が0件でした。CloudWatchのログを確認してください。"
    fi
else
    echo "  -> (jqが未インストールのため、レスポンスのチェックをスキップしました)"
fi


# 4. S3への書き込みを待つために少し待機
echo "🕒 S3への反映を待っています (5秒)..."
sleep 5

# 5. slack-sender Lambda関数を実行
echo "[2/2] Slack送信関数 ($SENDER_FUNCTION_NAME) を実行中..."
aws lambda invoke \
  --function-name "$SENDER_FUNCTION_NAME" \
  --region "$REGION" \
  "$SENDER_OUTPUT_FILE" > /dev/null # AWS CLIの標準出力を抑制

echo "✅ 実行完了。結果を $SENDER_OUTPUT_FILE に保存しました。"
echo ""
echo "🎉 テストが完了しました！"
echo "Slackに通知が届いているか確認してください。届いていない場合は各出力ファイルやCloudWatchログを確認してください。"