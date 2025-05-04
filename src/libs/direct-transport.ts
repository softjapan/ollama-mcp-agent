import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * クライアント側のトランスポート実装
 * サーバーとの直接通信を行うためのクラス
 * 
 * Transport インターフェースを実装し、サーバーとのメッセージのやり取りを担当する
 * メモリ上で直接メッセージを受け渡すため、WebSocketなどの実際のネットワーク通信は行わない
 */
class DirectClientTransport implements Transport {
  // 接続が閉じられた時のコールバック関数
  onclose?: () => void;
  
  // メッセージを受信した時のコールバック関数
  // JSONRPCMessage形式のメッセージを受け取る
  onmessage?: (message: JSONRPCMessage) => void;

  /**
   * @param serverTransport - サーバー側のトランスポートインスタンス
   * メッセージの送受信に使用する
   */
  constructor(private readonly serverTransport: Transport) {}

  /**
   * トランスポートの接続を開始する
   * 直接通信の場合は特に初期化処理は不要
   */
  async start(): Promise<void> {}
  
  /**
   * トランスポートの接続を閉じる
   * 登録されているoncloseコールバックを実行する
   */
  async close(): Promise<void> {
    this.onclose?.();
  }

  /**
   * サーバーにメッセージを送信する
   * @param message - 送信するJSONRPCメッセージ
   * サーバー側のonmessageコールバックを直接呼び出してメッセージを渡す
   */
  async send(message: JSONRPCMessage): Promise<void> {
    this.serverTransport.onmessage?.(message);
  }
}

/**
 * サーバー側のトランスポート実装
 * クライアントとの直接通信を行うためのクラス
 * 
 * Transport インターフェースを実装し、クライアントとのメッセージのやり取りを担当する
 * メモリ上で直接メッセージを受け渡すため、WebSocketなどの実際のネットワーク通信は行わない
 */
export class DirectServerTransport implements Transport {
  // 接続が閉じられた時のコールバック関数
  onclose?: () => void;
  
  // メッセージを受信した時のコールバック関数
  // JSONRPCMessage形式のメッセージを受け取る
  onmessage?: (message: JSONRPCMessage) => void;
  
  // クライアント側のトランスポートインスタンス
  private readonly clientTransport: DirectClientTransport;

  /**
   * サーバートランスポートのインスタンスを作成し、
   * 対応するクライアントトランスポートも同時に初期化する
   */
  constructor() {
    this.clientTransport = new DirectClientTransport(this);
  }

  /**
   * トランスポートの接続を開始する
   * 直接通信の場合は特に初期化処理は不要
   */
  async start(): Promise<void> {}

  /**
   * トランスポートの接続を閉じる
   * 登録されているoncloseコールバックを実行する
   */
  async close(): Promise<void> {
    this.onclose?.();
  }

  /**
   * クライアントにメッセージを送信する
   * @param message - 送信するJSONRPCメッセージ
   * クライアント側のonmessageコールバックを直接呼び出してメッセージを渡す
   */
  async send(message: JSONRPCMessage): Promise<void> {
    this.clientTransport.onmessage?.(message);
  }

  /**
   * 対応するクライアントトランスポートのインスタンスを取得する
   * @returns DirectClientTransport クライアント側のトランスポートインスタンス
   */
  getClientTransport(): DirectClientTransport {
    return this.clientTransport;
  }
}
