#!/bin/bash

# ====================================
# MonTopi 本番サーバー診断スクリプト
# ====================================

echo "🔍 MonTopi本番環境診断を開始..."
echo ""

# カラーコード
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 環境変数チェック
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 1. 環境変数チェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ENV_FILE="/www/wwwroot/root/git/dist/server/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ .envファイルが見つかりません: $ENV_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓ .envファイルが存在します${NC}"
echo ""

# 必須環境変数のチェック
check_env_var() {
    local var_name=$1
    local var_value=$(grep "^${var_name}=" "$ENV_FILE" | cut -d '=' -f2-)
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}✗ $var_name が設定されていません${NC}"
        return 1
    else
        # 機密情報は一部のみ表示
        if [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"PASSWORD"* ]]; then
            echo -e "${GREEN}✓ $var_name = ${var_value:0:10}...${NC}"
        else
            echo -e "${GREEN}✓ $var_name = $var_value${NC}"
        fi
        return 0
    fi
}

echo "Cognito設定:"
check_env_var "COGNITO_REGION"
check_env_var "COGNITO_USER_POOL_ID"
echo ""

echo "Stripe設定:"
check_env_var "STRIPE_PUBLIC_KEY"
check_env_var "STRIPE_SECRET_KEY"
echo ""

echo "データベース設定:"
check_env_var "DB_HOST"
check_env_var "DB_NAME"
check_env_var "DB_USER"
check_env_var "DB_PASSWORD"
echo ""

# 2. MySQLデータベースチェック
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 2. MySQLデータベースチェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DB_NAME=$(grep "^DB_NAME=" "$ENV_FILE" | cut -d '=' -f2)
DB_USER=$(grep "^DB_USER=" "$ENV_FILE" | cut -d '=' -f2)
DB_PASSWORD=$(grep "^DB_PASSWORD=" "$ENV_FILE" | cut -d '=' -f2)

# MySQLが稼働しているか確認
if systemctl is-active --quiet mysql || systemctl is-active --quiet mysqld; then
    echo -e "${GREEN}✓ MySQLサービスが稼働中${NC}"
else
    echo -e "${RED}✗ MySQLサービスが停止しています${NC}"
    echo "  起動コマンド: systemctl start mysql"
    exit 1
fi

# データベース接続テスト
if mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME; SELECT 1;" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ データベース接続成功${NC}"
    
    # テーブル数を確認
    TABLE_COUNT=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null)
    echo -e "  テーブル数: ${TABLE_COUNT}"
    
    # 題庫数を確認
    QUESTION_SET_COUNT=$(mysql -u"$DB_USER" -p"$DB_PASSWORD" -Nse "SELECT COUNT(*) FROM $DB_NAME.question_sets;" 2>/dev/null)
    echo -e "  題庫数: ${QUESTION_SET_COUNT}"
    
    if [ "$QUESTION_SET_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠ 題庫が0件です。管理画面からJSONをアップロードしてください${NC}"
    fi
else
    echo -e "${RED}✗ データベース接続に失敗しました${NC}"
    exit 1
fi
echo ""

# 3. PM2プロセスチェック
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  3. PM2プロセスチェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✓ PM2がインストールされています${NC}"
    
    # MonTopiプロセスの状態確認
    if pm2 list | grep -q "montopi-server"; then
        PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="montopi-server") | .pm2_env.status')
        
        if [ "$PM2_STATUS" == "online" ]; then
            echo -e "${GREEN}✓ montopi-serverが稼働中${NC}"
        else
            echo -e "${RED}✗ montopi-serverが停止中 (status: $PM2_STATUS)${NC}"
            echo "  再起動コマンド: pm2 restart montopi-server"
        fi
    else
        echo -e "${YELLOW}⚠ montopi-serverプロセスが見つかりません${NC}"
        echo "  起動コマンド: pm2 start ecosystem.config.js"
    fi
else
    echo -e "${RED}✗ PM2がインストールされていません${NC}"
    echo "  インストールコマンド: npm install -g pm2"
fi
echo ""

# 4. Nginxチェック
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 4. Nginxチェック"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v nginx &> /dev/null; then
    echo -e "${GREEN}✓ Nginxがインストールされています${NC}"
    
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓ Nginxが稼働中${NC}"
    else
        echo -e "${RED}✗ Nginxが停止しています${NC}"
        echo "  起動コマンド: systemctl start nginx"
    fi
    
    # 設定ファイルのテスト
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✓ Nginx設定ファイルが正常${NC}"
    else
        echo -e "${RED}✗ Nginx設定にエラーがあります${NC}"
        nginx -t
    fi
else
    echo -e "${RED}✗ Nginxがインストールされていません${NC}"
fi
echo ""

# 5. ポート使用状況
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 5. ポート使用状況"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_port() {
    local port=$1
    local service=$2
    
    if netstat -tuln | grep -q ":$port "; then
        echo -e "${GREEN}✓ ポート $port ($service) が使用中${NC}"
    else
        echo -e "${RED}✗ ポート $port ($service) が開いていません${NC}"
    fi
}

check_port "5000" "MonTopi Backend"
check_port "80" "HTTP"
check_port "443" "HTTPS"
check_port "3306" "MySQL"
echo ""

# 6. ディスク使用量
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💽 6. ディスク使用量"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DISK_USAGE=$(df -h /www/wwwroot | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓ ディスク使用量: ${DISK_USAGE}% (正常)${NC}"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠ ディスク使用量: ${DISK_USAGE}% (注意)${NC}"
else
    echo -e "${RED}✗ ディスク使用量: ${DISK_USAGE}% (警告)${NC}"
fi
echo ""

# 7. 最近のエラーログ
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 7. 最近のエラーログ (PM2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pm2 &> /dev/null; then
    echo "最新のエラーログ（最新10行）:"
    pm2 logs montopi-server --err --lines 10 --nostream 2>/dev/null || echo "エラーログがありません"
else
    echo "PM2がインストールされていません"
fi
echo ""

# まとめ
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 診断結果サマリー"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔧 問題が見つかった場合の対応:"
echo ""
echo "1. Cognitoエラー:"
echo "   → /www/wwwroot/root/git/dist/server/.env を編集"
echo "   → COGNITO_REGION=ap-southeast-2"
echo "   → COGNITO_USER_POOL_ID=ap-southeast-2_El0UTGvLD"
echo "   → pm2 restart montopi-server"
echo ""
echo "2. 題庫が0件:"
echo "   → https://montopi.com にアクセス"
echo "   → 管理者でログイン → 管理ページ"
echo "   → JSON一括アップロードで題庫を追加"
echo ""
echo "3. サーバーが起動しない:"
echo "   → pm2 logs montopi-server --lines 50"
echo "   → エラーメッセージを確認"
echo ""
echo "詳細ドキュメント:"
echo "  - 環境変数設定: docs/production/PRODUCTION_ENV_SETUP.md"
echo "  - デプロイガイド: PRODUCTION_DEPLOY.md"
echo ""
