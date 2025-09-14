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
    const prompt = `
あなたは起業家向けのニュースキュレーターです。昨日から今日にかけての最新ニュースを調査し、起業に役立つテック、経済、ビジネス関連の重要なニュースを5-7件選んでレポートを作成してください。

重要: すべて日本語で回答してください。

各ニュースには以下の情報を含めてください：
- タイトル: 日本語のニュース見出し
- カテゴリー: tech、business、economyのいずれか
- 詳細情報: 500文字以上の詳しい日本語要約と起業家への影響分析
- 重要度: 1-5の数値（5が最重要）
- ソースURL: 実在する信頼できるニュースソースの正確なURL（TechCrunch、Bloomberg、Reuters、日経、Forbes等の実際の記事URL）

対象となるニュースソース：
- TechCrunch, Bloomberg, Reuters, 日経新聞, VentureBeat, Harvard Business Review, MIT Technology Review, Forbes

注意: 
- ソースURLは必ず実在する記事のURLを提供してください。架空のURLは使用しないでください。
- JSONにはコメント（//）を一切含めないでください。
- 純粋なJSONのみを返してください。

以下のJSON形式で日本語で回答してください（コメント禁止）：
{
  "articles": [
    {
      "title": "日本語のニュースタイトル",
      "category": "tech",
      "summary": "500文字以上の日本語での詳細な要約と分析...",
      "importance": 4,
      "sourceUrl": "https://techcrunch.com/2024/09/12/actual-article-url"
    }
  ]
}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSONを抽出（```json マークダウンを除去）
      console.log('Raw Gemini response:', text);

      // ```json から ``` までの部分を抽出、またはJSONオブジェクトを直接抽出
      let jsonString = text;

      // ```json が含まれている場合は除去
      if (text.includes('```json')) {
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error(`No valid JSON object found in response. Response: ${text.substring(0, 500)}`);
        }
        jsonString = text.substring(jsonStart, jsonEnd + 1);
      } else {
        // 通常のJSON抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error(`No valid JSON found in response. Response: ${text.substring(0, 500)}`);
        }
        jsonString = jsonMatch[0];
      }

      // JSON文字列の完全クリーニング
      jsonString = jsonString
        .replace(/\/\/.*$/gm, '') // 行コメント除去
        .replace(/\/\*[\s\S]*?\*\//g, '') // ブロックコメント除去
        .replace(/\n/g, ' ') // すべての改行をスペースに変換
        .replace(/\r/g, ' ') // キャリッジリターンをスペースに変換  
        .replace(/\t/g, ' ') // タブをスペースに変換
        .replace(/\s+/g, ' ') // 複数の空白を1つに統一
        .trim(); // 前後の空白除去
      
      // JSON文字列内の改行を適切にエスケープ
      jsonString = jsonString.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match, content) => {
        return '"' + content.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
      });
      
      console.log('Cleaned JSON:', jsonString);
      
      try {
        const parsedData = JSON.parse(jsonString);
        
        console.log('JSON parsed successfully, articles:', parsedData.articles?.length || 0);
        
        return {
          date: new Date().toISOString().split('T')[0],
          articles: parsedData.articles,
          totalCount: parsedData.articles.length,
          generatedAt: new Date().toISOString()
        };
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Problematic JSON:', jsonString.substring(0, 1000));
        throw new Error(`JSON parse failed: ${parseError.message}`);
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to generate news report: ${error}`);
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Hello');
      return true;
    } catch (error) {
      console.error('API Key validation failed:', error);
      return false;
    }
  }
}