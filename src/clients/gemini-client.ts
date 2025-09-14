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
        
        // フォールバック: より堅牢なJSON修復
        try {
          console.log('Attempting advanced JSON repair...');
          
          // 完全な記事の境界を探す
          const articles = [];
          let currentPos = 0;
          
          // "title" でスタートする記事を探す
          while (true) {
            const titlePos = jsonString.indexOf('"title":', currentPos);
            if (titlePos === -1) break;
            
            // この記事の開始位置を見つける
            let articleStart = titlePos;
            while (articleStart > 0 && jsonString[articleStart] !== '{') {
              articleStart--;
            }
            
            // この記事の終了位置を見つける
            let braceCount = 0;
            let articleEnd = articleStart;
            let inString = false;
            let escape = false;
            
            for (let i = articleStart; i < jsonString.length; i++) {
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
                
                if (braceCount === 0) {
                  articleEnd = i;
                  break;
                }
              }
            }
            
            // 完全な記事を抽出
            if (braceCount === 0) {
              const articleJson = jsonString.substring(articleStart, articleEnd + 1);
              try {
                const article = JSON.parse(articleJson);
                if (article.title && article.category && article.summary) {
                  // 不完全なURLを修正
                  if (!article.sourceUrl || article.sourceUrl === 'https:' || article.sourceUrl.length < 10) {
                    article.sourceUrl = 'https://techcrunch.com/';
                  }
                  articles.push(article);
                }
              } catch (e) {
                console.log('Failed to parse article, skipping...');
              }
            }
            
            currentPos = articleEnd + 1;
            if (articles.length >= 5) break; // 最大5記事まで
          }
          
          if (articles.length > 0) {
            console.log(`JSON repair successful, extracted ${articles.length} articles`);
            
            return {
              date: new Date().toISOString().split('T')[0],
              articles: articles,
              totalCount: articles.length,
              generatedAt: new Date().toISOString()
            };
          }
        } catch (repairError) {
          console.error('JSON repair failed:', repairError);
        }
        
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