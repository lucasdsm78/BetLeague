module.exports = {
  root: true,
  extends: ['./.eslintrc.cjs'],
  ignorePatterns: ['build/', 'node_modules/'],
  rules: {
    '@typescript-eslint/no-unused-expressions': 'off',
    'import/first': 'off',
    'react-hooks/rules-of-hooks': 'off',
    'testing-library/prefer-find-by': 'off',
    'testing-library/no-container': 'off',
    'testing-library/no-node-access': 'off',
    'jest/no-conditional-expect': 'off',
    'no-restricted-globals': 'off',
  },
};

