export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'en',
    locales: [{
      code: 'en',
      name: 'English',
    }, {
      code: 'ko',
      name: '한국어',
    }],
    strategy: 'prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
  },
})
