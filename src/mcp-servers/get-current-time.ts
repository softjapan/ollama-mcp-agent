// MCPサーバーの機能を提供するためのインポート
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// MCPサーバーのインスタンスを作成
// name: サーバーの識別名
// version: サーバーのバージョン情報
const server = new McpServer({
  name: "時間表示サーバー",
  version: "1.0.0",
});

// 現在時刻を取得するツールを定義
// 第1引数: ツール名
// 第2引数: ツールの説明
// 第3引数: ツールの実装(非同期関数)
server.tool("get-current-time", "現在の時刻を返す", async () => {
  // 戻り値のオブジェクト構造:
  // content: レスポンスの内容を配列で指定
  //   - type: コンテンツタイプ(ここではテキスト)
  //   - text: 実際の出力テキスト
  return {
    content: [
      {
        type: "text",
        text: new Date().toLocaleString("ja-JP", {
          year: "numeric",    // 年(数値)
          month: "long",      // 月(長い形式 例: 1月)
          day: "numeric",     // 日(数値)
          weekday: "long",    // 曜日(長い形式 例: 月曜日)
          hour: "2-digit",    // 時(2桁)
          minute: "2-digit",  // 分(2桁)
          second: "2-digit",  // 秒(2桁)
        }),
      },
    ],
  };
});

// サーバーインスタンスをエクスポート
export const TimeServer = server;
