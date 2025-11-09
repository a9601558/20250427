# 本番環境デプロイガイド (Production Deployment Guide)

📅 **作成日**: 2025年11月9日  
🏷️ **バージョン**: ver8  
✅ **ステータス**: 本番リリース準備完了

---

## 📋 目次 (Table of Contents)

1. [前提条件](#前提条件)
2. [デプロイ前チェックリスト](#デプロイ前チェックリスト)
3. [バックアップ手順](#バックアップ手順)
4. [デプロイ手順](#デプロイ手順)
5. [デプロイ後の検証](#デプロイ後の検証)
6. [ロールバック手順](#ロールバック手順)
7. [トラブルシューティング](#トラブルシューティング)

---

## ✅ 前提条件 (Prerequisites)

### サーバー環境
- ✅ Node.js v16+ インストール済み
- ✅ MySQL 8.0+ 稼働中
- ✅ PM2 グローバルインストール済み
- ✅ Nginx 設定済み
- ✅ Git インストール済み

### 必要な権限
- ✅ サーバーSSHアクセス権限
- ✅ データベース管理権限
- ✅ PM2プロセス管理権限

---

## 📝 デプロイ前チェックリスト (Pre-Deployment Checklist)

### コード品質確認

- [x] **フロントエンドビルド成功**
  ```bash
  npm run build
  ✓ built in 1.54s
  ```

- [x] **バックエンドビルド成功**
  ```bash
  cd server && npm run build
  ✓ TypeScript compiled successfully
  ```

- [x] **未使用のimport削除**
  - AdminJSONUpload.tsx - toast import コメントアウト
  - RedeemCodeAdmin.tsx - toast import コメントアウト

- [x] **コンパイルエラー修正**
  - deleteRedeemCode未実装機能の処理完了

- [x] **全toastnotification無効化**
  - 127+ toast calls コメントアウト完了
  - UI干渉の削減

### Git状態確認

```bash
Current Branch: ver8
Latest Commits:
- 63aedf6 fix: 修復編譯錯誤和代碼質量問題
- 4276042 docs: 添加關閉toast通知的完整文檔
- cea5e7f fix: 關閉所有組件中的toast提示
```

### 機能確認

- [x] **JSON題庫アップロード** - 順序修正完了
- [x] **質問表示順序** - フロントエンド＋バックエンド修正完了
- [x] **選択肢表示順序** - A, B, C, D 正常表示
- [x] **Toast通知** - 全て無効化完了

---

## 💾 バックアップ手順 (Backup Procedures)

### 1. データベースバックアップ

```bash
# サーバーに接続
ssh user@your-server

# データベース全体をバックアップ
mysqldump -u root -p exam_system > /backup/exam_system_$(date +%Y%m%d_%H%M%S).sql

# バックアップファイルを確認
ls -lh /backup/exam_system_*.sql
```

### 2. アプリケーションコードバックアップ

```bash
# 現在のコードをバックアップ
cd /www/wwwroot/root
tar -czf git_backup_$(date +%Y%m%d_%H%M%S).tar.gz git/

# バックアップを安全な場所に移動
mv git_backup_*.tar.gz /backup/
```

### 3. PM2プロセス状態保存

```bash
# 現在のPM2状態を保存
pm2 save

# PM2リストをエクスポート
pm2 list > /backup/pm2_list_$(date +%Y%m%d_%H%M%S).txt
```

---

## 🚀 デプロイ手順 (Deployment Procedures)

### Step 1: コード取得

```bash
# プロジェクトディレクトリに移動
cd /www/wwwroot/root/git

# 現在のブランチ確認
git branch
# * ver8

# 最新コードをプル
git pull origin ver8

# プル成功を確認
git log -1
# commit 63aedf6... fix: 修復編譯錯誤和代碼質量問題
```

### Step 2: フロントエンド再ビルド

```bash
# 依存関係インストール（初回またはpackage.json変更時のみ）
npm install

# プロダクションビルド
npm run build

# ビルド成功を確認
ls -lh dist/
# index.html, assets/ フォルダ存在を確認
```

### Step 3: バックエンド再ビルド

```bash
# サーバーディレクトリに移動
cd server

# 依存関係インストール（初回またはpackage.json変更時のみ）
npm install

# TypeScriptコンパイル
npm run build

# ビルド成功を確認
ls -lh dist/
# index.js など生成ファイル確認
```

### Step 4: データベースマイグレーション（必要な場合）

```bash
# マイグレーション実行（今回は不要）
# npm run migrate

# 題庫順序確認スクリプト（オプション）
node fix-question-order.cjs
```

### Step 5: PM2サービス再起動

```bash
# バックエンドサーバー再起動
pm2 restart exam-server

# フロントエンドクライアント再起動
pm2 restart exam-client

# 再起動状態確認
pm2 status

# ログ確認（エラーがないか）
pm2 logs exam-server --lines 50
pm2 logs exam-client --lines 50
```

### Step 6: Nginx設定リロード（設定変更時のみ）

```bash
# 設定テスト
sudo nginx -t

# Nginx リロード
sudo nginx -s reload

# Nginx ステータス確認
sudo systemctl status nginx
```

---

## ✅ デプロイ後の検証 (Post-Deployment Verification)

### 1. サービス稼働確認

```bash
# PM2プロセス確認
pm2 status
# exam-server: online
# exam-client: online

# ポート確認
netstat -tlnp | grep -E ":(3000|5000)"
# 3000番(フロントエンド)と5000番(バックエンド)がLISTEN状態
```

### 2. 健全性チェック

```bash
# バックエンドAPI確認
curl http://localhost:5000/api/health
# {"status":"ok"}

# フロントエンド確認
curl -I http://localhost:3000
# HTTP/1.1 200 OK
```

### 3. 機能テスト

#### ブラウザテスト項目

| 項目 | 確認内容 | 期待結果 |
|------|----------|----------|
| **ホームページ表示** | トップページアクセス | 正常表示、エラーなし |
| **ログイン機能** | Cognitoログイン | 認証成功 |
| **題庫一覧** | 題庫リスト表示 | 全題庫表示 |
| **JSON題庫アップロード** | 管理画面でJSON題庫追加 | 順序通りに問題表示 |
| **質問表示順序** | 題庫の問題確認 | Q-0001, Q-0002, Q-0003... 順 |
| **選択肢順序** | 各問題の選択肢 | A, B, C, D 順 |
| **Toast通知** | 各種操作実行 | Toast表示なし |
| **進捗保存** | 問題回答 | 進捗正常保存 |
| **支払い機能** | 有料題庫購入フロー | 正常動作 |
| **兌換コード** | コード入力 | 正常に有効化 |

### 4. パフォーマンス確認

```bash
# サーバーリソース確認
top
# CPUとメモリ使用率確認

# データベース接続確認
mysql -u root -p -e "SELECT COUNT(*) FROM exam_system.questions;"

# ログファイルサイズ確認
ls -lh /www/wwwroot/root/git/server/logs/
```

---

## ⏮️ ロールバック手順 (Rollback Procedures)

### 緊急時のロールバック

```bash
# 1. 前のcommitに戻る
cd /www/wwwroot/root/git
git log --oneline -5
# 問題のあるcommitを特定

# 2. ロールバック実行
git revert <commit-hash>
# または
git reset --hard <previous-good-commit>

# 3. 再ビルド
npm run build
cd server && npm run build

# 4. サービス再起動
pm2 restart all

# 5. 検証
pm2 logs --lines 100
```

### データベースロールバック

```bash
# バックアップから復元
mysql -u root -p exam_system < /backup/exam_system_20251109_HHMMSS.sql

# 復元確認
mysql -u root -p -e "SELECT COUNT(*) FROM exam_system.questions;"
```

---

## 🔧 トラブルシューティング (Troubleshooting)

### 問題1: PM2サービスが起動しない

**症状**: `pm2 restart exam-server` が失敗

**解決方法**:
```bash
# エラーログ確認
pm2 logs exam-server --lines 100 --err

# プロセスを完全停止して再起動
pm2 delete exam-server
pm2 start ecosystem.config.js --only exam-server

# ポート競合確認
lsof -i :5000
```

### 問題2: データベース接続エラー

**症状**: `ECONNREFUSED` エラー

**解決方法**:
```bash
# MySQL稼働確認
sudo systemctl status mysql

# 接続テスト
mysql -u root -p

# .envファイル確認
cat server/.env | grep DB_
```

### 問題3: フロントエンドページが表示されない

**症状**: 白い画面またはビルドファイルが読み込めない

**解決方法**:
```bash
# distフォルダ確認
ls -la dist/

# Nginx設定確認
sudo nginx -t
cat /etc/nginx/sites-enabled/your-site.conf

# Nginxエラーログ
tail -100 /var/log/nginx/error.log
```

### 問題4: 質問順序がまだ正しくない

**症状**: JSON題庫の問題が順序通りに表示されない

**解決方法**:
```bash
# データベースorderIndex確認
node server/fix-question-order.cjs

# 問題があれば修正実行
node server/fix-question-order.cjs --fix

# PM2再起動
pm2 restart exam-server
```

---

## 📊 デプロイ結果サマリー (Deployment Summary)

### ✅ 完了事項

- [x] Python一時スクリプト削除
- [x] 未使用import削除
- [x] コンパイルエラー修正
- [x] フロントエンド・バックエンドビルド成功
- [x] 全toast通知無効化
- [x] Git commit & push完了
- [x] 本番デプロイ準備完了

### 📦 デプロイパッケージ情報

```
Branch: ver8
Latest Commit: 63aedf6
Build Size:
  - Frontend: 973.51 kB (gzipped: 278.83 kB)
  - Backend: TypeScript compiled
Modified Files: 12 files
Toast Disabled: 127+ instances
```

### 🔄 今後の改善項目

1. **兌換コード削除API実装**
   - 後端に `DELETE /redeem-codes/:id` 追加
   - RedeemCodeAdmin.tsx の handleDeleteCode 有効化

2. **パフォーマンス最適化**
   - Code splitting実装（bundle size > 500kB警告対応）
   - 動的import活用

3. **監視強化**
   - Sentry エラーログ統合（オプション）
   - PM2 メトリクス収集

---

## 📞 サポート情報 (Support Information)

### デプロイ中に問題が発生した場合

1. **即座にロールバック**: 上記「ロールバック手順」参照
2. **ログ収集**: PM2, Nginx, MySQL エラーログ
3. **データベースバックアップ確認**: `/backup/` ディレクトリ

### 関連ドキュメント

- `関閉全部toast通知.md` - Toast無効化詳細
- `JSON題庫順序問題完整修復記録.md` - 題庫順序修正記録
- `PRODUCTION_DEPLOYMENT_GUIDE.md` - 本文書

---

## ✅ デプロイ完了チェックリスト

最終確認：

- [ ] バックアップ完了
- [ ] コード最新化（git pull）
- [ ] フロントエンドビルド成功
- [ ] バックエンドビルド成功
- [ ] PM2サービス再起動
- [ ] サービス稼働確認（pm2 status）
- [ ] ホームページアクセス確認
- [ ] ログイン機能テスト
- [ ] 題庫表示テスト
- [ ] 質問順序確認（Q-0001, Q-0002...）
- [ ] Toast通知非表示確認
- [ ] エラーログ確認（PM2 logs）

**全てチェック完了後、本番リリース完了！** 🎉

---

**作成者**: GitHub Copilot  
**最終更新**: 2025年11月9日  
**デプロイバージョン**: ver8 (commit 63aedf6)
