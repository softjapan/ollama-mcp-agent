// 必要なモジュールのインポート
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import OpenAI from "openai";
import { DirectServerTransport } from "./libs/direct-transport.js";
import { TimeServer } from "./mcp-servers/get-current-time.js";
import { WeatherServer } from "./mcp-servers/get-weather.js";
import express, { Request, Response, RequestHandler } from 'express';
import path from 'path';

// 型定義のインポート
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ChatCompletionContentPartText,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources.mjs";

/**
 * MCPツールを初期化し、OpenAIのツール形式に変換する関数
 * @param servers - MCPサーバーの配列
 * @returns ツール情報、関数マップ、クローズ関数を含むオブジェクト
 */
const getMcpTools = async (servers: McpServer[]) => {
  const tools: ChatCompletionTool[] = [];
  const functionMap: Record<string, Client> = {};
  const clients: Client[] = [];
  
  // 各サーバーに対してMCPクライアントを初期化
  for (const server of servers) {
    const mcpClient = new Client({
      name: "mcp-client-cli",
      version: "1.0.0",
    });
    // MCPサーバーとクライアントを直接接続
    const transport = new DirectServerTransport();
    server.connect(transport);
    await mcpClient.connect(transport.getClientTransport());

    clients.push(mcpClient);
    // 利用可能なツール一覧を取得
    const toolsResult = await mcpClient.listTools();
    tools.push(
      ...toolsResult.tools.map((tool): ChatCompletionTool => {
        functionMap[tool.name] = mcpClient;
        return {
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        };
      })
    );
  }
  
  // クライアントをクローズする関数
  const close = () => {
    return Promise.all(
      clients.map(async (v) => {
        await v.close();
      })
    );
  };
  return { tools, functionMap, close };
};

// Expressアプリケーションの設定
const app = express();
app.use(express.json());
app.use(express.static('public'));

// ルートパスへのアクセスでHTMLファイルを提供
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// クエリリクエストの型定義
interface QueryRequest {
  query: string;
}

/**
 * クエリを処理するハンドラー関数
 * ユーザーの入力を受け取り、OpenAIとMCPツールを使用して応答を生成
 */
const queryHandler: RequestHandler = async (req, res, next) => {
  try {
    // リクエストからクエリを取得
    const { query: userQuery } = req.body;
    if (!userQuery) {
      res.status(400).json({ error: 'クエリが必要です' });
      return;
    }
    console.log(`\n[question] ${userQuery}`);

    // OpenAIクライアントの初期化（Ollamaを使用）
    const openai = new OpenAI({
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    
    // MCPツールの初期化
    const mcpTools = await getMcpTools([TimeServer, WeatherServer]);
    const model = "qwen2.5-coder:14b";

    // チャットメッセージの初期設定
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "日本語を使用する,タグを出力しない,plain/textで回答する",
      },
      {
        role: "user",
        content: userQuery,
      },
    ];

    // OpenAIに最初のリクエストを送信
    const response = await openai.chat.completions.create({
      model,
      messages: messages,
      tools: mcpTools.tools,
    });

    // レスポンスの処理
    for (const content of response.choices) {
      if (content.finish_reason === "tool_calls" && content.message.tool_calls) {
        // ツール呼び出しが必要な場合の処理
        await Promise.all(
          content.message.tool_calls.map(async (toolCall) => {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;
            const mcp = mcpTools.functionMap[toolName];
            console.info(`[tool] ${toolName} ${toolArgs}`);
            if (!mcp) {
              throw new Error(`Tool ${toolName} not found`);
            }

            // ツールを実行して結果を取得
            const toolResult = await mcp.callTool({
              name: toolName,
              arguments: JSON.parse(toolArgs),
            });
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolResult.content as Array<ChatCompletionContentPartText>,
            });
          })
        );

        // ツール実行結果を含めて最終的な応答を生成
        const finalResponse = await openai.chat.completions.create({
          model,
          messages,
          max_completion_tokens: 512,
          stream: true,
        });

        // ストリーミングレスポンスを逐次送信
        for await (const message of finalResponse) {
          const content = message.choices[0].delta.content;
          if (content) {
            res.write(content);
          }
        }
      } else {
        // ツール呼び出しが不要な場合は直接応答を送信
        res.write(content.message.content || '');
      }
    }

    // MCPツールをクローズしてレスポンスを終了
    await mcpTools.close();
    res.end();
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
};

// クエリ処理のエンドポイントを設定
app.post('/query', queryHandler);

/**
 * メイン関数
 * サーバーを起動し、ポート80でリッスン
 */
async function main() {
  const port = 80;
  app.listen(port, () => {
    console.log(`サーバーが起動しました: http://localhost:${port}`);
  });
}

main();
