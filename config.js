const config = {
  gatsby: {
    pathPrefix: '/',
    siteUrl: 'https://relay-kr.github.io',
    gaTrackingId: null,
    trailingSlash: false,
  },
  header: {
    logo: '',
    logoLink: '',
    title: "<a href='https://relay-kr.github.io/'>Relay</a>",
    githubUrl: 'https://github.com/daangn/relay-kr.github.io',
    helpUrl: '',
    tweetText: '',
    links: [{ text: '', link: '' }],
    search: {
      enabled: true,
      indexName: 'relay-kr',
      // algoliaAppId: process.env.GATSBY_ALGOLIA_APP_ID,
      // algoliaSearchKey: process.env.GATSBY_ALGOLIA_SEARCH_KEY,
      // algoliaAdminKey: process.env.ALGOLIA_ADMIN_KEY,
    },
  },
  sidebar: {
    forcedNavOrder: [
      '/getting-started',
      '/a-guided-tour',
      '/guides',
      '/principles-and-architecture',
    ],
    collapsedNav: ['/a-guided-tour/rendering-data-basics'],
    links: [],
    frontline: false,
    ignoreIndex: true,
  },
  siteMetadata: {
    title: 'Relay | daangn',
    description: 'Relay in korean, served by daangn.com',
    ogImage: 'https://github.com/daangn/relay-kr.github.io/relay.png',
    docsLocation: 'https://github.com/daangn/relay-kr.github.io/tree/main/content',
    favicon: 'https://github.com/daangn/relay-kr.github.io/favicon.svg',
  },
  pwa: {
    enabled: false, // disabling this will also remove the existing service worker.
    manifest: {
      name: 'relay-kr',
      short_name: 'relay-kr',
      start_url: '/',
      background_color: '#6b37bf',
      theme_color: '#6b37bf',
      display: 'standalone',
      crossOrigin: 'use-credentials',
      icons: [
        {
          src: 'https://github.com/daangn/relay-kr/favicon.svg',
          sizes: `512x512`,
          type: `image/svg`,
        },
      ],
    },
  },
};

module.exports = config;