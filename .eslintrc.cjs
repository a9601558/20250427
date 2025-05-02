{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "plugins": ["@typescript-eslint", "react", "react-hooks"],
  "settings": {
    "react": {
      "version": "detect"
    }
  },
  "env": {
    "browser": true,
    "node": true,
    "es6": true
  },
  "rules": {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "no-console": "warn",
    "no-debugger": "warn",
    "react/prop-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    
    "camelcase": ["warn", { "properties": "never" }],
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        "selector": "variable",
        "format": ["camelCase", "UPPER_CASE"],
        "leadingUnderscore": "allow"
      },
      {
        "selector": "function",
        "format": ["camelCase", "PascalCase"]
      },
      {
        "selector": ["class", "interface", "typeAlias", "enum"],
        "format": ["PascalCase"]
      },
      {
        "selector": "enumMember",
        "format": ["PascalCase"]
      }
    ],

    "indent": "off",
    "quotes": ["warn", "single", { "avoidEscape": true }],
    "semi": ["warn", "always"],
    "arrow-parens": ["warn", "always"],
    "no-multiple-empty-lines": ["warn", { "max": 1, "maxEOF": 1 }],
    "object-curly-spacing": ["warn", "always"],
    "comma-dangle": ["warn", "always-multiline"],
    "eol-last": ["warn", "always"],
    
    "react/react-in-jsx-scope": "off",
    "react/display-name": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-pascal-case": "warn"
  },
  "overrides": [
    {
      "files": ["**/*.tsx"],
      "rules": {
        "@typescript-eslint/naming-convention": [
          "warn",
          {
            "selector": "function",
            "format": ["PascalCase"]
          }
        ]
      }
    }
  ]
} 