import { WebClient } from '@slack/web-api';
import { NewsReport, NewsArticle } from './gemini-client'; // NewsArticleもインポート

export class SlackClient {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendNewsReport(channelId: string, report: NewsReport): Promise<boolean> {
    try {
      // 送信する記事が0件の場合は、メッセージを送らずに正常終了とする
      if (report.totalCount === 0) {
        console.log('No articles to send, skipping Slack message.');
        return true;
      }

      const formattedMessage = this.formatNewsReport(report);

      const result = await this.client.chat.postMessage({
        channel: channelId,
        text: `📰 今日の起業家向けニュース (${report.date})`, // 通知用のフォールバックテキスト
        blocks: formattedMessage
      });

      return result.ok || false;
    } catch (error) {
      console.error('Slack API Error:', error);
      return false;
    }
  }

  private formatNewsReport(report: NewsReport): any[] {
    const blocks: any[] = [];

    // 1. ヘッダー
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📰 今日の起業家向けニュース'
      }
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📅 ${report.date} | 📊 ${report.totalCount}件のニュース | 🕐 生成時刻: ${new Date(report.generatedAt).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
        }
      ]
    });

    blocks.push({ type: 'divider' });

    // 2. カテゴリ定義と表示順の固定
    const categories = {
      tech: { name: 'テック', emoji: '💻' },
      business: { name: 'ビジネス', emoji: '💼' },
      economy: { name: '経済', emoji: '📈' },
      politics: { name: '政治', emoji: '🏛️' },
      entertainment: { name: 'エンタメ', emoji: '🎬' }
    };
    const categoryOrder: (keyof typeof categories)[] = ['tech', 'business', 'economy', 'politics', 'entertainment'];

    // 3. 定義した順序で各カテゴリーのニュースを追加
    categoryOrder.forEach(categoryKey => {
      const articles = report.articles.filter(a => a.category === categoryKey);
      if (articles.length === 0) return; // そのカテゴリの記事がなければスキップ

      const categoryInfo = categories[categoryKey];

      // カテゴリヘッダー
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${categoryInfo.emoji} ${categoryInfo.name}*`
        }
      });

      articles.forEach((article, index) => {
        // 記事のタイトル、要約、URLボタン
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${article.title}*\n\n${article.summary}`
          },
          accessory: {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '記事を読む'
            },
            url: article.sourceUrl,
            // 重複を避けるためIDをユニークにする
            action_id: `read_article_${categoryKey}_${index}`
          }
        });

        // AIによる考察 (改行をサポートするsectionブロックで表示)
        if (article.ai_insight) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `* <AI考察>:*\n${article.ai_insight}`
            }
          });
        }

        blocks.push({ type: 'divider' });
      });
    });

    // 4. フッター
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🤖 *SlackNews* powered by Gemini AI | 次回配信: 明日 8:00 AM'
        }
      ]
    });

    return blocks;
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.client.auth.test();
      return result.ok || false;
    } catch (error) {
      console.error('Slack connection test failed:', error);
      return false;
    }
  }
}