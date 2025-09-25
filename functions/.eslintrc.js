module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    "ecmaVersion": 2018,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": "off",
    "max-len": "off",
    "indent": "off",
    "comma-dangle": "off",
    "require-jsdoc": "off",
    "object-curly-spacing": "off",
    "padded-blocks": "off",
    "no-trailing-spaces": "off",
    "eol-last": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};