// lint-staged.config.js
module.exports = {
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix --config .eslintrc.cjs',
    'prettier --write',
  ],
  '*.{json,css,scss,md}': [
    'prettier --write',
  ],
}; 