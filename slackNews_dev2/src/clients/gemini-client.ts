import { GoogleGenerativeAI } from '@google/generative-ai';

export interface NewsArticle {
  title: string;
  summary: string;
  sourceUrl: string;
  // カテゴリを5種類に拡張
  category: 'tech' | 'business' | 'economy' | 'politics' | 'entertainment';
  // importanceを削除し、ai_insightを追加
  ai_insight: string;
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
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  }

  async generateNewsReport(): Promise<NewsReport> {
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const prompt = `あなたは、トップクラスのベンチャーキャピタルに所属する優秀なニュースアナリスト兼AIストラテジストです。あなたの任務は、多忙な起業家のために、膨大な情報の中から重要なシグナルを特定し、日々のブリーフィングを作成することです。

本日は ${today} です。以下の厳格なルールに従って、ニュース記事を生成してください。

### ルール
1.  ****最重要: 今日のニュースのみ****:
    **本日 (${today}) に日本で報じられた、あるいは発生した最新ニュースのみ**を厳選してください。もし、この日に報じられた重要なニュースが全くない場合は、決して架空のニュースを作成せず、と${today} の前日もしくは、前々日のレポートを絞り出して作成してください。それ以降のニュースは参考にしないでください。

2.  ****ホットトピックの選定**:
    その日に日本で最も話題となったホットトピックを最大5件まで選び、それぞれを「tech」「business」「economy」「politics」「entertainment」のいずれかに分類してください。全てのカテゴリを無理に含める必要はありません。重要なニュースがないカテゴリは省略して構いません。

3.  ****具体的で詳細な要約**:
    各記事の「要約」は、起業家が状況を即座に理解できるよう、**箇条書きを用いたレポート形式**で具体的に記述してください。単なる事実の羅列ではなく、背景や重要性を解説し、文字数は300文字程度まで許容します。

4.  ****AIによる独自の考察**:
    各記事に、AIアナリストとしてのあなたの独自の視点である「AIの考察」を必ず加えてください。そのニュースがもたらす将来的な影響、潜在的なビジネスチャンス、または破壊的変化について分析してください（約150文字）。

5.  ****正確な情報源URL**:
    各記事の「sourceUrl」には、**そのニュースを報じている実際の情報源のURLを必ず記載してください。** 関連性のないURLや架空のURL、トップページのURLは絶対に使用しないでください。

6.  ****厳格なJSON形式**:
    以下のJSON形式を寸分違わず守り、余計なテキストやマークダウンを含めず、JSONオブジェクトのみを出力してください。

### JSON出力形式の例
{
  "articles": [
    {
      "title": "（ここに具体的な日本語タイトル）",
      "category": "tech",
      "summary": "（起業家への示唆を含む箇条書きの日本語要約）",
      "ai_insight": "（AIによる150文字程度の日本語での考察）",
      "sourceUrl": "（記事の具体的な情報源URL）"
    }
  ]
}
`;

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
    // ai_insightも必須項目としてチェック
    return article.title && article.category && article.summary && article.ai_insight;
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
