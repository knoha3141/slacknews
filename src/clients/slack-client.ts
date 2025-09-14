import { WebClient } from '@slack/web-api';
import { NewsReport } from './gemini-client';

export class SlackClient {
  private client: WebClient;

  constructor(token: string) {
    this.client = new WebClient(token);
  }

  async sendNewsReport(channelId: string, report: NewsReport): Promise<boolean> {
    try {
      const formattedMessage = this.formatNewsReport(report);
      
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text: '📰 今日のスタートアップニュース',
        blocks: formattedMessage
      });

      return result.ok || false;
    } catch (error) {
      console.error('Slack API Error:', error);
      return false;
    }
  }

  private formatNewsReport(report: NewsReport): any[] {
    const blocks = [];

    // ヘッダー
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📰 今日のスタートアップニュース'
      }
    });

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📅 ${report.date} | 📊 ${report.totalCount}件のニュース | 🕐 生成時刻: ${new Date(report.generatedAt).toLocaleTimeString('ja-JP')}`
        }
      ]
    });

    blocks.push({
      type: 'divider'
    });

    // カテゴリー別にニュースを整理
    const categorizedNews = {
      tech: report.articles.filter(a => a.category === 'tech'),
      business: report.articles.filter(a => a.category === 'business'),
      economy: report.articles.filter(a => a.category === 'economy')
    };

    const categoryEmojis = {
      tech: '💻',
      business: '💼',
      economy: '📈'
    };

    const categoryNames = {
      tech: 'テック',
      business: 'ビジネス',
      economy: '経済'
    };

    // 各カテゴリーのニュースを追加
    Object.entries(categorizedNews).forEach(([category, articles]) => {
      if (articles.length === 0) return;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${categoryEmojis[category as keyof typeof categoryEmojis]} ${categoryNames[category as keyof typeof categoryNames]}*`
        }
      });

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
            text: {
              type: 'plain_text',
              text: '記事を読む'
            },
            url: article.sourceUrl,
            action_id: `read_article_${index}`
          }
        });

        blocks.push({
          type: 'divider'
        });
      });
    });

    // フッター
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