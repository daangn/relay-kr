const config = {
  gatsby: {
    pathPrefix: '/',
    siteUrl: 'https://relay-ko.github.io',
    gaTrackingId: null,
    trailingSlash: false,
  },
  header: {
    logo: '',
    logoLink: '',
    title: "<a href='https://relay-ko.github.io/'>Relay</a>",
    githubUrl: 'https://github.com/daangn/relay-kr',
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
      '/a-guided-tour', // add trailing slash if enabled above
      '/guides',
      '/principles-and-architecture',
    ],
    collapsedNav: [
      '/A Guided Tour/Rendering Data Basics', // add trailing slash if enabled above
      '/A Guided Tour/Reusing Cached Data for Rendering',
      '/A Guided Tour/Refreshing and Refetching',
      '/A Guided Tour/Rendering List Data and Pagination',
      '/A Guided Tour/Updating Data',
      '/A Guided Tour/Managing Data Outside React',
    ],
    links: [],
    frontline: false,
    ignoreIndex: true,
  },
  siteMetadata: {
    title: 'Relay | daangn',
    description: 'Relay in korean, served by daangn.com',
    ogImage: 'https://github.com/daangn/relay-kr/relay.png',
    docsLocation: 'https://github.com/daangn/relay-kr/tree/main/content',
    favicon: 'https://github.com/daangn/relay-kr/favicon.svg',
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
