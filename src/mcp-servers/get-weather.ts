// MCPサーバーの機能を提供するためのインポート
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// バリデーション用のzodをインポート
import { z } from "zod";

// 気象庁APIのレスポンス型定義
// 地域情報を表すインターフェース
interface Center {
  name: string;        // 地域名(日本語)
  enName: string;      // 地域名(英語)
  officeName?: string; // 気象台名
  children?: string[]; // 子地域のID配列
  parent?: string;     // 親地域のID
  kana?: string;       // 地域名(かな)
}

// 地域情報のマップ型
interface Centers {
  [key: string]: Center;
}

// 全地域情報を含む型
interface Area {
  centers: Centers;   // 地方
  offices: Centers;   // 気象台
  class10s: Centers;  // 都道府県
  class15s: Centers;  // 一次細分区域
  class20s: Centers;  // 市町村等
}

// 天気予報情報の型
interface Weather {
  publishingOffice: string; // 発表気象台
  reportDatetime: Date;     // 発表日時
  targetArea: string;       // 対象地域
  headlineText: string;     // 見出し文
  text: string;            // 予報本文
}

// MCPサーバーのインスタンスを作成
const server = new McpServer({
  name: "天気予報サーバー",
  version: "1.0.0",
});

// 天気予報を取得するツールを定義
server.tool(
  "get-weather",                    // ツール名
  `指定した都道府県の天気予報を返す`, // ツールの説明
  {
    // 入力パラメータのスキーマ定義
    name: z.string({
      description: "都道府県名の漢字、例「東京」、「北海道」",
    }),
  },
  // ツールの実装(非同期関数)
  async ({ name: areaName }) => {
    // 1. 気象庁APIから地域情報を取得
    const result = await fetch(
      "https://www.jma.go.jp/bosai/common/const/area.json"
    )
      .then((v) => v.json())
      .then((v: Area) => v.offices)
      // 指定された地域名に一致する地域IDを抽出
      .then((v: Centers) =>
        Object.entries(v).flatMap(([id, { name }]) =>
          name.includes(areaName) ? [id] : []
        )
      );

    // 2. 各地域IDに対応する天気予報を取得
    const weathers = await Promise.all(
      result.map((id) =>
        fetch(
          `https://www.jma.go.jp/bosai/forecast/data/overview_forecast/${id}.json`
        )
          .then((v) => v.json())
          .then((v: Weather) => v.text)
      )
    );

    // 3. 取得した天気予報を結合して返却
    return {
      content: [
        {
          type: "text",
          text: weathers.join("---"), // 複数地域の予報を区切り文字で結合
        },
      ],
    };
  }
);

// サーバーインスタンスをエクスポート
export const WeatherServer = server;
