# 📚 ドキュメント索引

このディレクトリには、プロジェクトの各種ドキュメントが整理されています。

## 📁 ディレクトリ構成

```
docs/
├── fix-records/          # 修正記録（バグ修正・機能改善）
├── production/           # 本番環境関連ドキュメント
├── deployment/           # デプロイガイド（詳細版）
├── CLEANUP_REPORT.md     # プロジェクトクリーンアップ報告
├── GIT_COMMIT_GUIDE.md   # Gitコミットガイドライン
├── JSON_IMPORT_FEATURE.md # JSON題庫インポート機能説明
├── PROJECT_COMPLETION_SUMMARY.md # プロジェクト完成サマリー
└── model-associations.md # データモデル関連図
```

---

## 🔧 修正記録 (fix-records/)

過去のバグ修正と機能改善の詳細記録

| ファイル | 内容 | 日付 |
|---------|------|------|
| `JSON題庫顺序問題完整修复記録.md` | JSON題庫順序問題の完全な修正記録 | 2025-11 |
| `題目顺序問題最終修复.md` | 質問表示順序の最終修正 | 2025-11 |
| `題目顺序顯示問題修复.md` | 質問表示順序の初期修正 | 2025-11 |
| `選項標籤重複問題修复.md` | 選択肢ラベル重複問題の修正 | 2025-11 |
| `選項編號順序修复.md` | 選択肢番号順序の修正 | 2025-11 |
| `JSON題庫顯示問題修复總結.md` | JSON題庫表示問題の修正総括 | 2025-11 |
| `関閉全部toast通知.md` | Toast通知無効化の記録 | 2025-11-09 |

**修正内容サマリー:**
- ✅ JSON題庫が順序通りに表示されない → 修正完了
- ✅ フロントエンドのランダムシャッフル → 削除
- ✅ バックエンドORDER BY欠如 → 追加
- ✅ 選択肢の表示順序 → A, B, C, D順に修正
- ✅ Toast通知（127+ instances） → 全て無効化

---

## 🚀 本番環境 (production/)

本番デプロイに関する最新ドキュメント

| ファイル | 内容 | 用途 |
|---------|------|------|
| `PRODUCTION_DEPLOYMENT_GUIDE_JP.md` | 詳細なデプロイガイド（日本語） | 初めてのデプロイ時 |
| `PRODUCTION_READY_REPORT.md` | 本番リリース最終確認レポート | デプロイ前の最終チェック |

**クイックスタート:** 本番デプロイは `/PRODUCTION_DEPLOY.md`（ルート）を参照

---

## 📦 デプロイガイド (deployment/)

詳細なデプロイ手順書（複数環境対応）

| ファイル | 内容 |
|---------|------|
| `PRODUCTION_DEPLOYMENT_GUIDE.md` | 完全なデプロイガイド |
| `AWS_COGNITO_PRODUCTION_DEPLOYMENT.md` | AWS Cognito設定ガイド |
| `MIGRATION_GUIDE.md` | マイグレーションガイド |
| `nginx-setup.md` | Nginx設定ガイド |

---

## 📋 プロジェクト管理

| ファイル | 内容 |
|---------|------|
| `PROJECT_COMPLETION_SUMMARY.md` | プロジェクト完成報告書 |
| `CLEANUP_REPORT.md` | コードクリーンアップ報告 |
| `GIT_COMMIT_GUIDE.md` | Gitコミット規約 |
| `JSON_IMPORT_FEATURE.md` | JSON題庫インポート機能仕様 |

---

## 🗂️ その他

| ファイル | 内容 |
|---------|------|
| `model-associations.md` | データベースモデル関連図 |

---

## 🔍 よく使うドキュメント

### 初めてのセットアップ
1. `/README.md` - プロジェクト概要
2. `deployment/PRODUCTION_DEPLOYMENT_GUIDE.md` - デプロイ手順

### 日常のデプロイ
1. `/PRODUCTION_DEPLOY.md` - クイックデプロイガイド
2. `production/PRODUCTION_READY_REPORT.md` - デプロイ前チェック

### トラブルシューティング
1. `fix-records/` 配下の修正記録
2. `deployment/nginx-setup.md` - Nginx設定
3. `deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md` - 認証問題

---

## 📝 ドキュメント管理方針

### 命名規則
- `UPPERCASE_WITH_UNDERSCORES.md` - 重要ドキュメント
- `lowercase-with-dashes.md` - 一般ドキュメント
- `日本語ファイル名.md` - 修正記録（過去の経緯用）

### 更新ルール
1. 新しい修正記録 → `fix-records/` に追加
2. 本番関連の更新 → `production/` に追加
3. 古いドキュメント → `archived-docs-YYYYMMDD/` に移動

---

**最終更新**: 2025年11月9日  
**管理者**: GitHub Copilot
