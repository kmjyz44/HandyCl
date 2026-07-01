import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const SITE_URL = 'https://ono-fix.com';
const SITE_NAME = 'Ono-Fix';
const TAGLINE = 'One Photo. One Solution.';
const DESCRIPTION =
  'Ono-Fix — snap a photo of any home problem. Our AI identifies the issue and instantly matches you with the right trusted local pro. Plumbing, electrical, furniture assembly, cleaning and more.';
const OG_IMAGE = `${SITE_URL}/onofix-icon-512.png`;

// Optional analytics / verification (set in Netlify env at build time).
const GA4_ID = process.env.EXPO_PUBLIC_GA4_ID || '';
const GSC_VERIFICATION = process.env.EXPO_PUBLIC_GSC_VERIFICATION || '';

const swReg = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
// Capture the install prompt globally so React can trigger it even if the
// event fired before the component mounted.
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__onoFixInstallPrompt = e;
});
window.addEventListener('appinstalled', function () {
  window.__onoFixInstallPrompt = null;
});`;

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: OG_IMAGE,
      slogan: TAGLINE,
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'LocalBusiness',
      '@id': `${SITE_URL}/#localbusiness`,
      name: SITE_NAME,
      url: SITE_URL,
      image: OG_IMAGE,
      description: DESCRIPTION,
      priceRange: '$$',
      areaServed: { '@type': 'Country', name: 'United States' },
      address: { '@type': 'PostalAddress', addressCountry: 'US' },
    },
  ],
};

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Primary SEO */}
        <title>{`${SITE_NAME} — ${TAGLINE} | AI Home Services`}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="robots" content="index, follow, max-image-preview:large" />
        <link rel="canonical" href={SITE_URL} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:title" content={`${SITE_NAME} — ${TAGLINE}`} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:locale" content="en_US" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${SITE_NAME} — ${TAGLINE}`} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <link rel="apple-touch-icon" href="/onofix-icon-192.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />

        {/* Performance: preconnect to common origins */}
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />

        {/* Google Search Console verification */}
        {GSC_VERIFICATION ? <meta name="google-site-verification" content={GSC_VERIFICATION} /> : null}

        {/* JSON-LD structured data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Google Analytics 4 */}
        {GA4_ID ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');`,
              }}
            />
          </>
        ) : null}

        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: swReg }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
