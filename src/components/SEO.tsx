import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
}

const SEO: React.FC<SEOProps> = ({
  title = 'MonTopi - IT資格試験対策｜無料問題集・過去問｜AWS・SAP・Azure・Oracle最新問題',
  description = 'MonTopiは、AWS、SAP、Azure、Oracle、CCNA、LPIC、ITパスポートなど、あらゆるIT資格試験・ベンダー資格試験の無料問題集・過去問を提供する最大級のオンライン学習プラットフォームです。最新の試験問題で効率的に資格取得を目指せます。',
  keywords = 'IT資格,AWS認定,SAP資格,Azure資格,Oracle認定,CCNA,LPIC,ITパスポート,基本情報技術者,応用情報技術者,問題集,過去問,無料,試験対策,ベンダー資格,クラウド資格,最新問題,オンライン学習,資格取得,模擬試験,IT試験,認定試験',
  ogImage = 'https://montopi.com/montopi-logo.svg',
  canonical,
  noindex = false,
}) => {
  const fullTitle = title.includes('MonTopi') ? title : `${title} | MonTopi`;
  const robotsContent = noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={robotsContent} />
      
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      {canonical && <meta property="og:url" content={canonical} />}
      
      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default SEO;
