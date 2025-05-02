module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  settings: {
    react: {
      version: "detect"
    }
  },
  env: {
    browser: true,
    node: true,
    es6: true
  },
  rules: {
    // 错误和警告规则
    "no-unused-vars": "off", // 由 TypeScript 处理
    "@typescript-eslint/no-unused-vars": ["error"],
    "no-console": ["warn", { allow: ["warn", "error"] }], // 警告使用 console，鼓励使用 logger
    "no-debugger": "warn",
    "react/prop-types": "off", // 使用 TypeScript 时不需要 prop-types

    // 命名规范规则
    "camelcase": ["error", { properties: "never" }], // 强制使用驼峰命名
    "@typescript-eslint/naming-convention": [
      "error",
      // 变量、参数、属性使用 camelCase
      {
        "selector": "variable",
        "format": ["camelCase", "UPPER_CASE"],
        "leadingUnderscore": "allow"
      },
      // 函数使用 camelCase
      {
        "selector": "function",
        "format": ["camelCase", "PascalCase"] // PascalCase 允许 React 组件名
      },
      // 类、接口、类型、枚举使用 PascalCase
      {
        "selector": ["class", "interface", "typeAlias", "enum"],
        "format": ["PascalCase"]
      },
      // 枚举成员使用 PascalCase
      {
        "selector": "enumMember",
        "format": ["PascalCase"]
      }
    ],

    // 代码风格规则
    "indent": "off", // 由 Prettier 处理
    "quotes": ["error", "single", { "avoidEscape": true }],
    "semi": ["error", "always"],
    "arrow-parens": ["error", "always"],
    "no-multiple-empty-lines": ["error", { "max": 1, "maxEOF": 1 }],
    "object-curly-spacing": ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "eol-last": ["error", "always"],
    
    // React 规则
    "react/react-in-jsx-scope": "off", // React 17+ 不需要导入 React
    "react/display-name": "off",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react/jsx-pascal-case": "error" // 组件名必须使用 PascalCase
  },
  overrides: [
    // 对文件命名的特殊规则只能在覆盖中指定
    {
      "files": ["**/*.tsx"], // React 组件文件
      "rules": {
        // 确保 React 组件名和文件名使用 PascalCase
        "@typescript-eslint/naming-convention": [
          "error",
          {
            "selector": "function",
            "format": ["PascalCase"]
          }
        ]
      }
    }
  ]
}; 