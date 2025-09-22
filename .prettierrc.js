/** @type {import('prettier').Config} */
module.exports = {
  semi: false,
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
  printWidth: 80,
  arrowParens: 'always',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindConfig: './tailwind.config.ts',
  tailwindFunctions: ['cn', 'cva'],
  importOrder: ['^react', '^next', '<THIRD_PARTY_MODULES>', '^@/', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
}
