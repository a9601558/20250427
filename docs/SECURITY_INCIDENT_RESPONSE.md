# 🚨 機密情報漏洩への緊急対応ガイド

## ⚠️ 状況

GitHubリポジトリに以下の機密情報がコミットされました：

- **データベースパスワード**: `[REDACTED]`
- **影響を受けたコミット**: `47929e3` およびそれ以前

## 🔥 緊急対応（即座に実施）

### 1. **パスワードを即座に変更**

```bash
# MySQLにログイン
mysql -u root -p

# rootパスワードを変更
ALTER USER 'root'@'localhost' IDENTIFIED BY 'new_secure_password_here';
FLUSH PRIVILEGES;
EXIT;
```

### 2. **本番サーバーの.envファイルを更新**

```bash
# 本番サーバーで
cd /www/wwwroot/root/git/dist/server
nano .env

# DB_PASSWORDを新しいパスワードに変更
DB_PASSWORD=new_secure_password_here

# サーバー再起動
pm2 restart montopi-server
```

### 3. **ローカル環境の.envも更新**

```bash
# ローカルの.envファイルを編集
nano .env
nano server/.env

# 両方のDB_PASSWORDを変更
```

## 🧹 Git履歴からの完全削除（オプション）

⚠️ **警告**: これは履歴を書き換えるため、チーム開発の場合は慎重に！

### 方法1: BFG Repo-Cleaner（推奨）

```bash
# BFGをインストール
brew install bfg

# パスワードを含む文字列を削除
bfg --replace-text passwords.txt

# passwords.txt の内容:
# [OLD_PASSWORD]===>REDACTED

# 強制プッシュ
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

### 方法2: git filter-branch

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch docs/production/PRODUCTION_ENV_SETUP.md || true" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

## 📝 今後の予防策

### 1. **pre-commit フックを設定**

`.git/hooks/pre-commit` を作成：

```bash
#!/bin/bash

# 機密情報パターンをチェック
if git diff --cached | grep -E "(password|secret|key).*=.*[^_][a-zA-Z0-9]{8,}"; then
    echo "⚠️  機密情報が含まれている可能性があります！"
    echo "コミットを中止しました。"
    exit 1
fi
```

実行権限を付与：
```bash
chmod +x .git/hooks/pre-commit
```

### 2. **.gitignore を厳格化**

```gitignore
# 環境変数（絶対にコミットしない）
.env
.env.*
!.env.example
server/.env
server/.env.*
!server/.env.example

# 一時スクリプト（パスワードを含む可能性）
*-fix.cjs
fix-*.cjs
diagnose-*.sh
```

### 3. **Git Secretsをインストール**

```bash
# インストール
brew install git-secrets

# リポジトリに設定
git secrets --install
git secrets --register-aws

# カスタムパターンを追加
git secrets --add 'password.*=.*[a-zA-Z0-9]{8,}'
git secrets --add 'DB_PASSWORD=(?!your_|REDACTED)'
```

### 4. **GitHub Secret Scanningを有効化**

1. GitHubリポジトリ設定へ
2. **Security & analysis** タブ
3. **Secret scanning** を有効化
4. **Push protection** を有効化

## ✅ 確認チェックリスト

- [ ] MySQLのrootパスワードを変更した
- [ ] 本番サーバーの.envを更新した
- [ ] ローカル環境の.envを更新した
- [ ] サーバーを再起動した（pm2 restart）
- [ ] 新しいパスワードで接続できることを確認した
- [ ] .gitignoreに.envが含まれていることを確認
- [ ] pre-commitフックを設定した（オプション）
- [ ] Git Secretsをインストールした（オプション）
- [ ] GitHub Secret Scanningを有効化した

## 🔐 強力なパスワードの生成

```bash
# ランダムな強力なパスワードを生成
openssl rand -base64 32

# または
pwgen -s 32 1
```

## 📞 緊急時の連絡先

問題が発生した場合:
1. サーバー管理者に連絡
2. データベース管理者に連絡
3. セキュリティチームに報告

## 🎓 学んだ教訓

1. **環境変数は絶対にコミットしない**
2. **ドキュメントにも実際の機密情報を書かない**
3. **pre-commitフックで自動チェック**
4. **定期的にパスワードをローテーション**
5. **Secret Scanningツールを活用**

---

**最終更新**: 2025年11月9日
**緊急度**: 🔴 HIGH
**対応状況**: ✅ パスワード削除完了 / ⚠️ パスワード変更待ち
