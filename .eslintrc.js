module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'only-warn', 'sort-class-members'],
    extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/recommended',
        'prettier',
    ],
    root: true,
    env: {
        browser: true,
    },
    rules: {
        '@typescript-eslint/no-empty-interface': 'off',
        'no-useless-constructor': 'off',
        'import/extensions': 'off',
        'import/prefer-default-export': 'off',
        'class-methods-use-this': 'off',
        'lines-between-class-members': 'off',
        'no-plusplus': [1, { 'allowForLoopAfterthoughts': true }],
        'no-multi-assign': ["error", { 'ignoreNonDeclaration': true }],
        '@typescript-eslint/quotes': [
            'error',
            'single',
            {
                'avoidEscape': true,
                'allowTemplateLiterals': true
            }
        ],
        'import/no-unresolved': 'off',
        'import/order': [
            'error',
            {
                'pathGroups': [
                    {
                        'pattern': '@annoto/**',
                        'group': 'external',
                        'position': 'after',
                    }
                ],
                'pathGroupsExcludedImportTypes': ['builtin'],
                'newlines-between': 'never',
                'groups': [
                    'builtin',
                    'external',
                    'internal',
                    'parent',
                    'sibling',
                    'index',
                ],
            }
        ],
        'sort-class-members/sort-class-members': [
            1,
            {
                'order': [
                    '[configurationMethod]',
                    '[static-properties]',
                    '[static-methods]',
                    '[properties]',
                    '[conventional-private-properties]',
                    'constructor',
                    '[methods-and-arrow-functions]',
                    '[private-methods-and-arrow-functions]'
                ],
                'groups': {
                    'methods-and-arrow-functions':[ '[arrow-function-properties]', '[methods]', '[arrow-function-properties]'],
                    'private-methods-and-arrow-functions':[ '[private-arrow-functions-properties]', '[conventional-private-methods]', '[private-arrow-functions-properties]'],
                    'private-arrow-functions-properties': [{ 'private': true, 'propertyType': 'ArrowFunctionExpression' }],
                    'configurationMethod': [{ 'name': 'configure', 'type': 'method' }]
                },
                'accessorPairPositioning': 'getThenSet'
            }
        ],
        'no-use-before-define': 'off',
        'no-restricted-syntax': [
            'error',
            {
                selector: 'ForInStatement',
                message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
            },
            {
                selector: 'LabeledStatement',
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
            },
            {
                selector: 'WithStatement',
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
            },
        ],
        'no-continue': 'off',
        'object-curly-spacing': ['error', 'always'],
        '@typescript-eslint/explicit-function-return-type': ['error', {
            'allowExpressions': true,
        }],
        'no-shadow': 'off',
        '@typescript-eslint/no-shadow': 'error',
    },
    overrides: [
        {
            files: ['*.js'],
            rules: {
                '@typescript-eslint/no-var-requires': 'off',
                "@typescript-eslint/explicit-function-return-type": 'off',
                'no-multi-assign': ["error"],
                'no-shadow': 'error',
                "@typescript-eslint/no-shadow": "off",
            }
        },
        {
            files: ['*.spec.js', '*.spec.ts'],
            rules: {
                'jest/valid-expect': 0,
                'import/no-extraneous-dependencies': 'off',
            }
        },
    ]
};