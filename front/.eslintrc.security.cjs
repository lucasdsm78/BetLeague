module.exports = {
  root: true,
  extends: ['./.eslintrc.release.cjs'],
  plugins: ['no-unsanitized'],
  rules: {
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'react/jsx-no-target-blank': 'error',
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
    'no-restricted-syntax': [
      'error',
      {
        selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
        message: 'Documenter et sanétiser explicitement tout usage de dangerouslySetInnerHTML avant intégration.',
      },
    ],
  },
};


