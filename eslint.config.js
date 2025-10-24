import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    // Allow console in CLI application
    'no-console': 'off',
    // Allow process.env in Node.js CLI
    'node/prefer-global/process': 'off',
    // Allow global in tests (for mocking fetch)
    'no-restricted-globals': 'off',
  },
})
