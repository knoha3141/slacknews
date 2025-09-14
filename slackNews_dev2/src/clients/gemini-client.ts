import { GoogleGenerativeAI } from '@google/generative-ai';

export interface NewsArticle {
  title: string;
  summary: string;
  sourceUrl: string;
  category: 'tech' | 'business' | 'economy';
  importance: number;
}

export interface NewsReport {
  date: string;
  articles: NewsArticle[];
  totalCount: number;
  generatedAt: string;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async generateNewsReport(): Promise<NewsReport> {
    const prompt = `起業家向けニュース3件を日本語で作成してください。

各記事:
- タイトル: 日本語見出し
- カテゴリー: tech/business/economy
- 要約: 200文字の日本語要約
- 重要度: 1-5
- URL: https://techcrunch.com/

JSON形式のみで回答:
{"articles":[{"title":"日本語タイトル","category":"tech","summary":"200文字要約","importance":4,"sourceUrl":"https://techcrunch.com/"}]}`;

    try {
      // 1. プロンプト送信
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // 2. レスポンス整形
      console.log('Raw Gemini response:', text);
      let jsonString = text
        .replace(/```json|```/g, '')     // マークダウン除去
        .replace(/\n/g, '')              // 改行除去
        .replace(/\r/g, '')              // キャリッジリターン除去
        .trim();
      console.log('Cleaned JSON string:', jsonString);

      // 3. JSON解析 (失敗時は自動修復)
      try {
        const parsedData = JSON.parse(jsonString);
        return this.buildNewsReport(parsedData.articles);
      } catch (parseError) {
        console.log('JSON parse failed, attempting repair...');
        const repairedArticles = this.extractValidArticles(jsonString);
        return this.buildNewsReport(repairedArticles);
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to generate news report: ${error}`);
    }
  }

  private extractValidArticles(jsonString: string): NewsArticle[] {
    const articles: NewsArticle[] = [];
    let currentPos = 0;

    // "title"キーで記事境界を検出し部分的に抽出
    while (currentPos < jsonString.length && articles.length < 5) {
      const titlePos = jsonString.indexOf('"title":', currentPos);
      if (titlePos === -1) break;

      const articleStart = this.findArticleStart(jsonString, titlePos);
      const articleEnd = this.findArticleEnd(jsonString, articleStart);

      if (articleEnd > articleStart) {
        const articleJson = jsonString.substring(articleStart, articleEnd + 1);
        try {
          const article = JSON.parse(articleJson);
          if (this.isValidArticle(article)) {
            articles.push(this.fixArticleUrl(article));
          }
        } catch (e) {
          console.log('Failed to parse article, skipping...');
        }
      }
      
      currentPos = articleEnd + 1;
    }

    return articles;
  }

  private findArticleStart(jsonString: string, titlePos: number): number {
    let pos = titlePos;
    while (pos > 0 && jsonString[pos] !== '{') {
      pos--;
    }
    return pos;
  }

  private findArticleEnd(jsonString: string, start: number): number {
    let braceCount = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < jsonString.length; i++) {
      const char = jsonString[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        if (braceCount === 0) return i;
      }
    }
    
    return jsonString.length - 1;
  }

  private isValidArticle(article: any): boolean {
    return article.title && article.category && article.summary;
  }

  private fixArticleUrl(article: NewsArticle): NewsArticle {
    if (!article.sourceUrl || article.sourceUrl.length < 10) {
      article.sourceUrl = 'https://techcrunch.com/';
    }
    return article;
  }

  private buildNewsReport(articles: NewsArticle[]): NewsReport {
    return {
      date: new Date().toISOString().split('T')[0],
      articles: articles,
      totalCount: articles.length,
      generatedAt: new Date().toISOString()
    };
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.model.generateContent('Hello');
      return true;
    } catch (error) {
      return false;
    }
  }
}