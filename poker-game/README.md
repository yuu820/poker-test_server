# Online Poker Game

リアルタイムで遊べるテキサスホールデムポーカーゲーム

## 機能

- ユーザー登録・ログイン
- ログインボーナス・新規登録ボーナス
- マッチ作成・参加（5桁のコードで簡単参加）
- リアルタイムポーカーゲーム（WebSocket使用）
- 管理画面（ユーザー管理、システム設定、メッセージ配信）

## セットアップ

1. 依存関係のインストール
```bash
cd poker-game
npm install
```

2. 環境変数の設定
`.env`ファイルが既に作成されています。必要に応じて変更してください。

3. アプリケーションの起動
```bash
npm start
```

開発モードで起動する場合：
```bash
npm run dev
```

4. ブラウザでアクセス
```
http://localhost:3000
```

## 管理画面

管理画面にアクセスするには：
```
http://localhost:3000/html/admin.html
```

デフォルトの管理者認証情報：
- ユーザー名: admin
- パスワード: yu200820

## ゲームの遊び方

1. 新規登録またはログイン
2. ホーム画面でマッチを作成または参加
3. マッチ作成時は設定を行い、5桁のコードを友達に共有
4. マッチ参加時は5桁のコードを入力
5. 2人以上集まったらマッチ開始
6. テキサスホールデムのルールでプレイ

## 技術スタック

- Backend: Node.js, Express, Socket.io
- Database: SQLite3
- Frontend: HTML, CSS, JavaScript
- Authentication: JWT

## デプロイ

Renderでのデプロイに対応しています。WebSocketも使用可能です。