import pleaseai from '@pleaseai/eslint-config'

export default pleaseai(
  {
    formatters: true,
    ignores: [
      'dev-docs/**',
      // Standalone Nuxt docs app with its own toolchain; content uses MDC
      // component slot syntax (e.g. `# title` inside ::u-page-hero).
      'docs/**',
    ],
  },
  {
    rules: {
      // Allow console in CLI application
      'no-console': 'off',
      // Allow process.env in Node.js CLI
      'node/prefer-global/process': 'off',
    },
  },
  {
    files: ['test/**', 'tests/**'],
    rules: {
      // Allow global in tests (for mocking fetch)
      'no-restricted-globals': 'off',
    },
  },
)
