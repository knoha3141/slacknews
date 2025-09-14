"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiClient = void 0;
const generative_ai_1 = require("@google/generative-ai");
class GeminiClient {
    constructor(apiKey) {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    async generateNewsReport() {
        const prompt = `
起業家向けの最新ニュース3-4件を日本語でレポートしてください。

要件:
- 分野: テック、経済、ビジネス
- 詳細: 各記事300文字程度の要約
- 形式: 下記のJSON形式のみ返答（他のテキスト不要）

{
  "articles": [
    {
      "title": "日本語タイトル",
      "category": "tech",
      "summary": "300文字程度の日本語要約と起業への影響",
      "importance": 4,
      "sourceUrl": "https://techcrunch.com/"
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
            }
            else {
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
            }
            catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Problematic JSON:', jsonString.substring(0, 1000));
                throw new Error(`JSON parse failed: ${parseError.message}`);
            }
        }
        catch (error) {
            console.error('Gemini API Error:', error);
            throw new Error(`Failed to generate news report: ${error}`);
        }
    }
    async validateApiKey() {
        try {
            const result = await this.model.generateContent('Hello');
            return true;
        }
        catch (error) {
            console.error('API Key validation failed:', error);
            return false;
        }
    }
}
exports.GeminiClient = GeminiClient;
