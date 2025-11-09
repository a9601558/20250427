# 本番環境デプロイガイド

📅 **作成日**: 2025年11月9日  
🏷️ **バージョン**: ver8  
✅ **ステータス**: 本番リリース準備完了

---

## 📝 デプロイ前チェックリスト

### コード品質確認
- [x] フロントエンドビルド成功 (npm run build ✓)
- [x] バックエンドビルド成功 (server/npm run build ✓)
- [x] 全toast通知無効化 (127+ instances)
- [x] コンパイルエラー修正完了
- [x] Git commit & push完了 (ver8ブランチ)

### 最新コミット
```
63aedf6 - fix: 修復編譯錯誤和代碼質量問題
4276042 - docs: 添加關閉toast通知的完整文檔  
cea5e7f - fix: 關閉所有組件中的toast提示
```

---

## 💾 バックアップ手順

### 1. データベースバックアップ
```bash
ssh user@server
mysqldump -u root -p exam_system > /backup/exam_system_$(date +%Y%m%d_%H%M%S).sql
```

### 2. アプリケーションバックアップ
```bash
cd /www/wwwroot/root
tar -czf git_backup_$(date +%Y%m%d_%H%M%S).tar.gz git/
mv git_backup_*.tar.gz /backup/
```

---

## 🚀 デプロイ手順

### Step 1: コード取得
```bash
cd /www/wwwroot/root/git
git pull origin ver8
git log -1  # 最新コミット確認
```

### Step 2: フロントエンド再ビルド
```bash
npm install  # 必要な場合のみ
npm run build
ls -lh dist/  # ビルド確認
```

### Step 3: バックエンド再ビルド
```bash
cd server
npm install  # 必要な場合のみ
npm run build
ls -lh dist/  # ビルド確認
```

### Step 4: PM2サービス再起動
```bash
pm2 restart exam-server
pm2 restart exam-client
pm2 status  # ステータス確認
pm2 logs exam-server --lines 50  # ログ確認
```

### Step 5: Nginx設定リロード (必要な場合)
```bash
sudo nginx -t
sudo nginx -s reload
```

---

## ✅ デプロイ後の検証

### サービス稼働確認
```bash
pm2 status
# exam-server: online ✓
# exam-client: online ✓

curl http://localhost:5000/api/health
# {"status":"ok"} ✓
```

### ブラウザテスト項目
| 項目 | 確認内容 | 結果 |
|------|----------|------|
| ホームページ | トップページ表示 | ✓ |
| ログイン | Cognito認証 | ✓ |
| JSON題庫アップロード | 順序通り表示 | ✓ |
| 質問表示 | Q-0001, Q-0002順 | ✓ |
| 選択肢 | A, B, C, D順 | ✓ |
| Toast通知 | 非表示 | ✓ |
| 進捗保存 | 正常保存 | ✓ |

---

## ⏮️ ロールバック手順

### 緊急時のロールバック
```bash
cd /www/wwwroot/root/git
git log --oneline -5
git reset --hard <previous-commit>
npm run build && cd server && npm run build
pm2 restart all
```

### データベースロールバック
```bash
mysql -u root -p exam_system < /backup/exam_system_YYYYMMDD_HHMMSS.sql
```

---

## �� トラブルシューティング

### PM2サービス起動失敗
```bash
pm2 logs exam-server --lines 100 --err
pm2 delete exam-server
pm2 start ecosystem.config.js --only exam-server
```

### データベース接続エラー
```bash
sudo systemctl status mysql
mysql -u root -p
cat server/.env | grep DB_
```

### 質問順序不正
```bash
node server/fix-question-order.cjs
node server/fix-question-order.cjs --fix
pm2 restart exam-server
```

---

## 📊 デプロイ結果サマリー

### ✅ 完了事項
- Python一時スクリプト削除
- 未使用import削除
- 全toast通知無効化 (127+ instances)
- フロントエンド・バックエンドビルド成功
- Git push完了

### 📦 パッケージ情報
- Branch: ver8
- Commit: 63aedf6
- Frontend: 973.51 kB (gzipped: 278.83 kB)
- Backend: TypeScript compiled

---

## ✅ 最終チェックリスト

- [ ] バックアップ完了
- [ ] コード最新化 (git pull)
- [ ] ビルド成功
- [ ] PM2再起動
- [ ] サービス稼働確認
- [ ] ログイン機能テスト
- [ ] 題庫表示テスト
- [ ] 質問順序確認
- [ ] Toast非表示確認
- [ ] エラーログ確認

**全てチェック完了後、本番リリース完了！** 🎉

---

**最終更新**: 2025年11月9日  
**バージョン**: ver8 (63aedf6)
