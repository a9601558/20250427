import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Users, Award, Zap, Shield, Globe, TrendingUp, Heart } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">MonTopi について</h1>
            <p className="text-xl mb-8 leading-relaxed">
              IT資格取得をサポートする、最新のオンライン問題集プラットフォーム
            </p>
            <div className="flex justify-center gap-4">
              <Link
                to="/question-sets"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                問題集を探す
              </Link>
              <a
                href="https://github.com/a9601558/20250427"
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
              >
                GitHub で見る
              </a>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">私たちのミッション</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              MonTopiは、IT資格取得を目指す皆様が効率的に試験対策を行えるよう設計された、
              最新のオンライン問題集プラットフォームです。2025年に開発された本システムは、
              <span className="font-semibold text-blue-600"> AWS Cognito</span> による安全な認証、
              <span className="font-semibold text-blue-600"> React + TypeScript</span> による高速なUI、
              そして <span className="font-semibold text-blue-600">MySQL</span> による信頼性の高いデータ管理を実現しています。
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              私たちは、IT資格試験対策の障壁を取り除き、誰もが質の高い学習体験を得られる世界を目指しています。
              AWS、SAP、Azure、Oracle、CCNA、LPIC、ITパスポートなど、あらゆるIT資格・ベンダー資格の
              最新問題集・過去問を提供し、効率的な資格取得をサポートします。
            </p>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-gray-800 mb-12 text-center">MonTopi の特徴</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-blue-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">豊富な資格対応</h3>
              <p className="text-gray-600">
                AWS、SAP、Azure、Oracle、CCNA、LPICなど、あらゆるIT資格に対応。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-green-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">セキュア認証</h3>
              <p className="text-gray-600">
                AWS Cognito統合により、最高レベルのセキュリティでアカウントを保護。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-purple-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">学習進捗追跡</h3>
              <p className="text-gray-600">
                リアルタイムで正答率、学習履歴を可視化。成長を実感できます。
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-orange-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">高速パフォーマンス</h3>
              <p className="text-gray-600">
                Vite + React 18による最適化。ストレスフリーな学習体験。
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">豊富な問題集</h3>
              <p className="text-gray-600">
                資格別に整理された最新問題・過去問。無料・有料問題集を選択可能。
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-indigo-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">柔軟なアクセス</h3>
              <p className="text-gray-600">
                試用モードで無料お試し。Stripe決済またはクーポンで完全版を利用。
              </p>
            </div>

            {/* Feature 7 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-yellow-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Award className="w-8 h-8 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">2つの試験モード</h3>
              <p className="text-gray-600">
                練習モードで即座にフィードバック。試験モードで本番環境シミュレーション。
              </p>
            </div>

            {/* Feature 8 */}
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-shadow">
              <div className="bg-pink-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-pink-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">使いやすいUI</h3>
              <p className="text-gray-600">
                直感的なデザインと操作性。デスクトップ・タブレット・モバイル対応。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-gray-800 mb-12 text-center">技術スタック</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Frontend */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold mb-6 text-blue-600">Frontend</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  React 18.3 + TypeScript 5.5
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Vite 5.4（高速ビルド）
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  Tailwind CSS 3.4
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  AWS Amplify + Cognito
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                  React Context API
                </li>
              </ul>
            </div>

            {/* Backend */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold mb-6 text-green-600">Backend</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Node.js 16+ / Express.js
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  TypeScript 5.6
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  MySQL 8.0+ / Sequelize ORM
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  AWS Cognito + JWT
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                  Stripe API
                </li>
              </ul>
            </div>

            {/* Infrastructure */}
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold mb-6 text-purple-600">Infrastructure</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Nginx（Webサーバー）
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  PM2（プロセス管理）
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  MySQL（データベース）
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  AWS Cognito（認証）
                </li>
                <li className="flex items-center">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-3"></span>
                  Git / GitHub
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold mb-12 text-center">MonTopi の実績</h2>
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold mb-2">100+</div>
              <div className="text-xl opacity-90">総コミット数</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">50k+</div>
              <div className="text-xl opacity-90">コード行数</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">30+</div>
              <div className="text-xl opacity-90">コンポーネント数</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">40+</div>
              <div className="text-xl opacity-90">API数</div>
            </div>
          </div>
        </div>
      </section>

      {/* Development Team */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-gray-800 mb-12 text-center">開発チーム</h2>
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">オープンソースプロジェクト</h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                MonTopiは、IT資格取得を目指す方々のために、最新の技術スタックとAIアシスタントの協力により開発されました。
                AWS、SAP、Azure、Oracleなど、主要なベンダー資格の問題集を継続的に追加し、
                学習者の皆様の資格取得をサポートしています。
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-blue-600" />
                </div>
                <h4 className="text-xl font-semibold mb-2">連絡先</h4>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  zqiwei03@gmail.com
                </a>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-10 h-10 text-purple-600" />
                </div>
                <h4 className="text-xl font-semibold mb-2">AI開発支援</h4>
                <p className="text-gray-600">GitHub Copilot</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">今すぐ始めましょう</h2>
          <p className="text-xl mb-8 leading-relaxed">
            MonTopiで効率的なIT資格試験対策を体験してください。<br />
            無料問題集から気軽にスタートできます。
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              to="/question-sets"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors text-lg"
            >
              問題集を探す
            </Link>
            <Link
              to="/"
              className="border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors text-lg"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="py-12 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-gray-600 mb-4">
            MonTopiは継続的に改善・開発を続けています。
          </p>
          <p className="text-gray-600">
            お問い合わせやご提案は{' '}
            <a 
              href="zqiwei03@gmail.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              zqiwei03@gmail.com
            </a>
            {' '}からお願いします。
          </p>
          <div className="mt-6 pt-6 border-t border-gray-300">
            <p className="text-sm text-gray-500">
              © 2025 MonTopi. Built with ❤️ using React, TypeScript, and AWS.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
