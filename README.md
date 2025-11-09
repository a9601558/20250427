# MonTopi - モンゴル語試験練習システム

<div align="center">

![MonTopi Logo](public/montopi-logo.svg)

**現代的なオンライン試験練習プラットフォーム**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/a9601558/20250427)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-339933.svg)](https://nodejs.org/)

[デモ](https://your-demo-url.com) • [ドキュメント](./docs/) • [デプロイガイド](./PRODUCTION_DEPLOY.md)

</div>

---

## 📖 About MonTopi

**MonTopi**（モンゴル語 Topic の略）は、モンゴル語を中心とした多言語対応の試験練習プラットフォームです。AWS Cognitoを活用したセキュアな認証システム、柔軟な題庫管理、リアルタイムの学習進捗追跡機能を提供し、効率的な学習体験を実現します。

### 🎯 主な特徴

- **🌐 多言語対応**: モンゴル語、日本語、中国語のUI対応
- **📚 柔軟な題庫管理**: JSON形式での一括インポート、カテゴリー分類
- **🔐 セキュアな認証**: AWS Cognito統合、JWT認証
- **📊 学習進捗追跡**: リアルタイムの正答率、学習履歴の可視化
- **💳 決済機能**: Stripe統合による有料題庫の販売
- **🎫 クーポンシステム**: 兌換コード発行・管理機能
- **📱 レスポンシブデザイン**: デスクトップ・タブレット・モバイル対応
- **⚡ 高速パフォーマンス**: Vite + React 18による最適化

### 🛠️ 技術スタック

#### Frontend
- **Framework**: React 18.3 + TypeScript 5.5
- **Build Tool**: Vite 5.4
- **Styling**: Tailwind CSS 3.4
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Authentication**: AWS Amplify + Cognito

#### Backend
- **Runtime**: Node.js 16+
- **Framework**: Express.js 4.21
- **Language**: TypeScript 5.6
- **Database**: MySQL 8.0+
- **ORM**: Sequelize 6.37
- **Authentication**: AWS Cognito + JWT
- **Payment**: Stripe API

#### Infrastructure
- **Web Server**: Nginx
- **Process Manager**: PM2
- **Database**: MySQL
- **Cloud Services**: AWS Cognito
- **Version Control**: Git

### 🎨 主要機能

#### 👤 ユーザー機能
- AWS Cognitoによる安全なユーザー登録・ログイン
- プロフィール管理と学習統計
- 複数アカウント切り替え機能
- 学習進捗の自動保存

#### 📝 題庫機能
- カテゴリー別題庫検索・フィルタリング
- 単選択・複数選択問題対応
- JSON一括インポート（管理者）
- 問題順序の完全制御
- 試用モード（無料お試し）

#### 🎓 学習機能
- 2つの学習モード：練習モード・試験モード
- リアルタイム採点
- 間違えた問題の復習機能
- 詳細な解説表示
- 学習履歴の可視化

#### 💰 課金機能
- Stripe統合決済システム
- 有料題庫の販売
- 兌換コード（クーポン）システム
- 購入履歴管理

#### 🔧 管理機能
- 題庫作成・編集・削除
- JSON一括インポート
- 兌換コード生成・管理
- ユーザー管理
- コンテンツ管理

## 📚 ドキュメント

- **デプロイガイド**: [`PRODUCTION_DEPLOY.md`](./PRODUCTION_DEPLOY.md) - クイックデプロイ手順
- **詳細ドキュメント**: [`docs/`](./docs/) - 全ドキュメント索引
- **API仕様**: [`API_SPEC.md`](./API_SPEC.md) - RESTful APIドキュメント

## 项目简介

```
.
├── .git/                 # Git 仓库元数据
├── .github/              # (可能存在) GitHub 相关配置 (Actions, templates)
├── dist/                 # 构建后的前端静态资源
├── node_modules/         # Node.js 依赖
├── public/               # 静态资源目录 (会被直接复制到 dist)
├── server/               # 后端 Node.js 服务代码
│   ├── controllers/      # 控制器 (处理请求逻辑)
│   ├── models/           # 数据模型 (数据库交互)
│   ├── routes/           # API 路由定义
│   ├── middleware/       # 中间件
│   ├── config/           # 配置文件
│   ├── migrations/       # 数据库迁移文件
│   ├── seeders/          # 数据种子文件
│   ├── utils/            # 工具函数
│   └── ...               # 其他后端相关文件
├── src/                  # 前端源代码 (React + TypeScript)
│   ├── assets/           # 静态资源 (图片, 字体等)
│   ├── components/       # 可复用 UI 组件
│   ├── contexts/         # React Context (状态管理)
│   ├── utils/            # 工具函数
│   ├── services/         # API 请求服务
│   ├── App.tsx           # 应用根组件
│   └── main.tsx          # 应用入口文件
├── .gitattributes        # 定义 Git 如何处理特定文件
├── .gitignore            # 指定 Git 忽略的文件/目录
├── api-path-mapping.conf # (推测) Nginx/代理的 API 路径映射配置
├── api-path-test.sh      # API 路径测试脚本
├── api-proxy-settings.conf # (推测) API 代理配置
├── backend-route-diagnosis.js # 后端路由诊断脚本
├── cleanup-files.txt     # (推测) 需要清理的文件列表
├── code-cleanup-report.md # 代码清理报告
├── eslint.config.js      # ESLint 配置文件 (代码风格检查)
├── index.html            # SPA 的 HTML 入口文件
├── nginx-headers-only.conf # (推测) Nginx 仅含头信息的配置
├── nginx-setup.md        # Nginx 设置指南
├── nginx.conf            # Nginx 配置文件
├── package-lock.json     # 锁定依赖版本
├── package.json          # 项目元数据和依赖管理
├── postcss.config.js     # PostCSS 配置文件 (CSS 预处理)
├── README.md             # 项目说明文件 (就是你正在看的这个)
├── restart-server.cjs    # 重启服务器脚本 (CommonJS)
├── restart-server.js     # 重启服务器脚本 (ES Module)
├── route-fix-guide.md    # 路由修复指南
├── tailwind.config.js    # Tailwind CSS 配置文件
├── test-api-routes.sh    # API 路由测试脚本
├── test-register.js      # (推测) 测试注册相关脚本
├── tsconfig.json         # TypeScript 配置
└── vite.config.ts        # Vite 配置文件 (前端构建工具)
```

**结构分析:**

*   这是一个典型的全栈 Web 应用项目结构，前端使用 Vite + TypeScript (可能配合 React/Vue)，后端使用 Node.js + TypeScript。
*   前端代码位于 `src/`，后端代码位于 `server/`。
*   构建产物输出到 `dist/`。
*   包含丰富的配置文件，涵盖了构建、类型检查、代码风格、CSS 处理、Nginx 代理等。
*   存在多个脚本文件，用于测试、诊断、服务重启等辅助开发和运维任务。
*   文档比较齐全，包括 README、Nginx 设置指南和路由修复指南。
*   需要注意区分 `.js` 和 `.cjs` 文件，以及不同的 `tsconfig.*.json` 文件，它们可能用于不同的环境 (前端/后端/脚本)。
*   `public/` 目录下的文件会直接复制到构建目录，适合存放无需构建处理的静态资源。
*   建议进一步查看 `src/` 和 `server/` 目录下的具体结构，以了解更详细的模块划分。

## 快速开始

### 后端服务

1. 进入server目录
```bash
cd server
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑.env文件，填写必要的配置项
```

4. 启动服务
```bash
npm run dev
```

### 前端应用

1. 安装依赖
```bash
npm install
```

2. 启动开发服务器
```bash
npm run dev
```

## 部署到宝塔面板

本项目支持一键部署到宝塔面板，并会自动同步数据库结构。

### 部署步骤

1. 将代码上传到服务器
2. 进入server目录
```bash
cd server
```

3. 确保环境变量配置正确
```bash
cp .env.example .env
# 编辑.env文件，填写必要的数据库配置
```

4. 运行部署脚本
```bash
npm run baota-deploy
```

5. 启动服务器
```bash
npm start
```

6. 配置Nginx反向代理
使用项目根目录中的`nginx.conf`作为参考配置Nginx反向代理。

## 优化说明

本项目已经进行了全面优化：

1. **API路由一致性**：所有API路由路径已标准化，遵循RESTful设计原则
2. **数据库同步机制**：服务启动时自动检查并同步数据库结构
3. **宝塔面板部署**：提供专门的宝塔面板部署脚本，确保无缝部署
4. **代码结构优化**：清晰分离前后端代码，使用TypeScript提供类型安全
5. **自动化迁移**：使用Sequelize迁移系统确保数据库结构版本控制

## 主要功能

- 题库浏览与购买
- 题目练习与答题
- 学習進捗追踪
- 会员权限管理
- 兑换码系统

## 技术栈

- **前端**: React, TypeScript, Tailwind CSS
- **后端**: Node.js, Express, TypeScript
- **数据库**: MySQL, Sequelize ORM
- **认证**: JWT

## 数据库同步机制

本项目实现了全自动的数据库同步机制：

1. **启动时检查**：服务器启动时会自动检查数据库结构是否与代码定义一致
2. **自动迁移**：如果检测到不一致，系统会自动运行迁移脚本同步数据库结构
3. **兼容性保障**：迁移设计确保向前兼容，不会丢失或破坏现有数据
4. **部署集成**：宝塔面板部署脚本集成了数据库同步功能

## 贡献指南

1. Fork 该项目
2. 创建新的功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

MIT

## 功能特点

### 用户系统
- 用户注册和登录
- 个人资料管理
- 普通用户和管理员角色

### 题库系统
- 多种分类的题库
- 单选题和多选题支持
- 题目随机顺序
- 答题记录和进度保存
- 正确率统计

### 付费系统
- 免费题库和付费题库
- 付费题库支持试用部分题目
- Stripe集成进行支付处理
- 购买记录管理
- 有效期为6个月的访问权限

### 兑换码系统
- 管理员可生成兑换码
- 支持自定义有效期的兑换码
- 兑换码可用于获取付费题库访问权限
- 兑换记录管理

### 管理功能
- 用户管理：查看、添加、编辑、删除用户
- 题库管理：创建、编辑、删除题库
- 首页内容管理：编辑网站显示内容
- 兑换码管理：生成和跟踪兑换码使用情况

## 用户指南

### 作为普通用户

1. **浏览题库**
   - 在首页可以查看所有可用题库
   - 免费题库可直接访问
   - 付费题库显示価格和试用题目数量

2. **答题功能**
   - 选择题库开始答题
   - 查看答题进度和正确率
   - 复习错题和已答题目

3. **付费内容访问**
   - 在付费题库中，可以免费试用部分题目
   - 通过支付购买完整题库（有效期6个月）
   - 引換コードを入力する获取题库访问权限

4. **个人中心**
   - 查看学習進捗
   - 管理购买记录
   - 查看兑换码使用记录
   - 账户设置（开发中）

### 作为管理员

1. **用户管理**
   - 查看所有用户
   - 添加、编辑、删除用户

2. **题库管理**
   - 创建新题库和题目
   - 设置免费/付费状态
   - 编辑现有题库

3. **兑换码管理**
   - 为特定题库生成兑换码
   - 设置兑换码有效期
   - 批量生成兑换码
   - 跟踪兑换码使用情况

4. **内容管理**
   - 编辑首页内容
   - 管理网站设置

## 技术栈

- 前端：React、TypeScript、Tailwind CSS
- 状态管理：React Context API
- 路由：React Router
- 支付处理：Stripe
- 样式：Tailwind CSS

## 🚀 クイックスタート

### 前提条件
- Node.js 16+ インストール済み
- MySQL 8.0+ 稼働中
- AWS Cognito設定済み（本番環境）

### インストール

1. **リポジトリのクローン**
```bash
git clone https://github.com/a9601558/20250427.git
cd 20250427
```

2. **依存関係のインストール**
```bash
# フロントエンド
npm install

# バックエンド
cd server
npm install
```

3. **環境変数の設定**

⚠️ **重要**: `.env`ファイルには機密情報（APIキー、データベースパスワード等）が含まれます。**絶対にGitにコミットしないでください**。

```bash
# フロントエンド環境変数
cp .env.example .env
# 以下を設定:
# - VITE_STRIPE_PUBLIC_KEY: Stripe公開可能キー
# - VITE_API_BASE_URL: APIのベースURL

# バックエンド環境変数
cd server
cp .env.example .env
# 以下を設定:
# - DB_PASSWORD: MySQLパスワード
# - JWT_SECRET: JWT署名用シークレット
# - STRIPE_PUBLIC_KEY: Stripe公開可能キー
# - STRIPE_SECRET_KEY: Stripeシークレットキー（機密）
# - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID
```

📝 **Stripe設定例**:
```bash
# フロントエンド (.env)
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key_here

# バックエンド (server/.env)
STRIPE_PUBLIC_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here  # 絶対に公開しない！
```

4. **データベースのセットアップ**
```bash
# MySQLデータベース作成
mysql -u root -p
CREATE DATABASE exam_system;

# マイグレーション実行（サーバーディレクトリで）
cd server
npm run migrate
```

### 開発環境での実行

1. **バックエンドサーバー起動**
```bash
cd server
npm run dev
# http://localhost:5000 で起動
```

2. **フロントエンド開発サーバー起動**
```bash
# 新しいターミナルで、ルートディレクトリから
npm run dev
# http://localhost:3000 で起動
```

3. **ブラウザでアクセス**
```
http://localhost:3000
```

### 本番環境ビルド

```bash
# フロントエンド
npm run build

# バックエンド
cd server
npm run build
```

詳細は [`PRODUCTION_DEPLOY.md`](./PRODUCTION_DEPLOY.md) を参照してください。

## 📱 使い方

### 一般ユーザー向け

#### 1️⃣ アカウント登録・ログイン
- AWS Cognitoによる安全な認証
- Eメール認証
- パスワードリセット機能

#### 2️⃣ 題庫の閲覧と学習
- **無料題庫**: すぐに利用開始
- **有料題庫**: 試用モード（一部問題）→ 購入で完全アクセス
- カテゴリー検索・フィルタリング

#### 3️⃣ 学習モード
- **練習モード**: 即座にフィードバック、解説表示
- **試験モード**: 本番形式のテスト
- 学習進捗の自動保存

#### 4️⃣ 有料コンテンツへのアクセス
- **Stripe決済**: クレジットカード・デビットカード対応
- **兌換コード**: クーポンコード入力で無料アクセス
- 購入後6ヶ月間有効

#### 5️⃣ 学習管理
- 学習統計の確認
- 間違えた問題の復習
- 購入履歴の確認

### 管理者向け

#### 🔧 題庫管理
- 新規題庫作成
- JSON一括インポート（順序保持）
- 題庫編集・削除
- 無料/有料設定

#### 💳 決済管理
- 兌換コード生成（一括対応）
- 有効期限設定
- 使用状況追跡
- 購入記録管理

#### 👥 ユーザー管理
- ユーザー一覧
- 権限管理
- 学習状況確認

#### 🎨 コンテンツ管理
- ホームページ編集
- カテゴリー管理
- お知らせ設定

## 🔑 兌換コードと決済フロー

### 兌換コード（クーポン）の流れ

1. **管理者**: 管理画面で題庫用の兌換コードを生成
   - 対象題庫を選択
   - 有効期限を設定（デフォルト180日）
   - 生成数を指定（一括生成可能）

2. **ユーザー**: 題庫ページで「引換コードを入力」をクリック
   - 受け取ったコードを入力
   - 有効なコードで完全アクセス権を獲得

3. **システム**: 自動記録
   - 兌換履歴保存
   - 有効期限管理
   - 使用済みマーク

### Stripe決済の流れ

1. **購入開始**: 題庫ページで「購入」ボタンをクリック

2. **決済情報入力**: Stripeセキュア決済フォーム
   - クレジットカード情報
   - 自動検証

3. **決済処理**: Stripe API経由で安全に処理

4. **アクセス付与**: 
   - 購入記録保存
   - 6ヶ月間のアクセス権付与
   - 購入履歴に記録

5. **確認**: 購入完了通知とアクセス開始

## 📊 プロジェクト統計

- **開発期間**: 2025年10月〜11月
- **総コミット数**: 100+
- **コード行数**: 50,000+ lines
- **コンポーネント数**: 30+ React components
- **API エンドポイント数**: 40+ RESTful APIs
- **サポート言語**: 日本語、中国語、モンゴル語

## 🎯 最近の主要アップデート

### v1.0.0 (2025-11-09)
- ✅ JSON題庫一括インポート機能の順序制御修正
- ✅ 質問表示順序の完全制御実装
- ✅ 選択肢順序修正（A, B, C, D順）
- ✅ Toast通知の無効化（127+ instances）
- ✅ バックエンドORDER BY句追加
- ✅ フロントエンドシャッフルロジック削除
- ✅ コード品質改善とリファクタリング
- ✅ 本番環境デプロイガイド整備

詳細は [`docs/fix-records/`](./docs/fix-records/) を参照してください。

## 🤝 貢献

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。

### 開発ワークフロー

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを開く

コミットメッセージは [`docs/GIT_COMMIT_GUIDE.md`](./docs/GIT_COMMIT_GUIDE.md) に従ってください。

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 👥 開発チーム

- **プロジェクトオーナー**: [@a9601558](https://github.com/a9601558)
- **主要開発者**: GitHub Copilot AI Assistant

## 🙏 謝辞

このプロジェクトの開発にあたり、以下のオープンソースプロジェクトとサービスを利用しています：

- [React](https://reactjs.org/) - UIフレームワーク
- [TypeScript](https://www.typescriptlang.org/) - 型安全な開発
- [Vite](https://vitejs.dev/) - 高速ビルドツール
- [Tailwind CSS](https://tailwindcss.com/) - ユーティリティファーストCSS
- [Express.js](https://expressjs.com/) - バックエンドフレームワーク
- [Sequelize](https://sequelize.org/) - ORM
- [AWS Cognito](https://aws.amazon.com/cognito/) - 認証サービス
- [Stripe](https://stripe.com/) - 決済プラットフォーム
- [MySQL](https://www.mysql.com/) - データベース

## 📞 サポート

問題が発生した場合や質問がある場合は、以下の方法でご連絡ください：

- **Issues**: [GitHub Issues](https://github.com/a9601558/20250427/issues)
- **ドキュメント**: [`docs/`](./docs/) ディレクトリ
- **Email**: （メールアドレスがあれば記載）

## 🔗 関連リンク

- [本番デプロイガイド](./PRODUCTION_DEPLOY.md)
- [詳細ドキュメント](./docs/)
- [API仕様](./API_SPEC.md)
- [修正記録](./docs/fix-records/)
- [Nginx設定](./docs/deployment/nginx-setup.md)
- [AWS Cognito設定](./docs/deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md)

---

<div align="center">

**Made with ❤️ by MonTopi Team**

[⬆ トップに戻る](#montopi---モンゴル語試験練習システム)

</div>
