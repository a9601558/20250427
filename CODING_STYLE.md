# 代码风格和命名规范

本文档定义了项目代码的命名规范和风格指南，旨在提高代码的可读性、一致性和可维护性。所有团队成员都应该遵循这些规范。

## 通用原则

- **一致性优先**: 在整个项目中严格遵守选定的命名规范。
- **清晰简洁**: 命名应清晰地表达其意图，避免使用模糊或过于通用的名称。
- **避免缩写**: 尽量使用完整的单词，除非是广泛接受的缩写（如 id, url, http, api）。
- **使用英文**: 所有代码层面的命名（变量、函数、类、文件等）应使用英文。

## 文件和目录命名

### 文件命名规则

- **React 组件文件**: 使用 **PascalCase** (例如: `UserProfile.tsx`, `QuestionCard.tsx`)
- **非组件 TS/JS 文件**: 使用 **kebab-case** (例如: `api-client.ts`, `auth-middleware.ts`)
- **目录**: 使用 **kebab-case** (例如: `src/components/common`, `server/src/utils`)
- **测试文件**: 使用 `[filename].test.ts` 或 `[filename].spec.ts` (例如: `api-client.spec.ts`, `UserProfile.test.tsx`)

### 文件组织原则

- 按功能模块组织文件，相关文件应放在同一目录下
- 共享组件应放在 `components/common` 或类似目录下
- 页面级组件应放在顶级 `components` 目录下
- 工具函数应放在 `utils` 目录下
- API服务应放在 `services` 目录下

## TypeScript / JavaScript 变量命名

- **普通变量**: 使用 **camelCase** (例如: `userName`, `questionCount`)
- **常量**: 
  - 真正不变的常量: 使用 **SCREAMING_SNAKE_CASE** (例如: `API_TIMEOUT`, `DEFAULT_PAGE_SIZE`)
  - 使用 `const` 但可变的引用: 使用 **camelCase** (例如: `const userSettings = { theme: 'dark' }`)
- **布尔值**: 使用 `is`, `has`, `should`, `can` 等前缀 (例如: `isLoading`, `hasPermission`)
- **私有变量**: 使用下划线前缀 (例如: `_privateVariable`)

## 函数和方法命名

- 使用 **camelCase**
- 函数名应以动词开头，清晰表达其功能
  - 获取数据: `getUser()`, `fetchQuestionSet()`
  - 修改数据: `updateProfile()`, `saveProgress()`
  - 检查状态: `isAdmin()`, `hasAccess()`
  - 事件处理器: `handleSubmit()`, `onButtonClick()`

## 类、接口和类型别名

- **类**: 使用 **PascalCase** (例如: `UserService`, `QuestionRepository`)
- **接口**: 使用 **PascalCase** (例如: `UserProfile`, `QuestionSetResponse`)
- **类型别名**: 使用 **PascalCase** (例如: `UserId`, `QuestionType`)
- **枚举**: 使用 **PascalCase** 枚举名，**PascalCase** 枚举成员 (例如: `enum LogLevel { Info, Warning, Error }`)

## React 组件

- **组件名**: 使用 **PascalCase** (例如: `UserProfile`, `QuestionCard`)
- **组件文件名**: 使用与组件名相同的 **PascalCase** (例如: `UserProfile.tsx`)
- **上下文名称**: 使用 **PascalCase** 加上 `Context` 后缀 (例如: `UserContext`, `SocketContext`)
- **Provider组件**: 使用 **PascalCase** 加上 `Provider` 后缀 (例如: `UserProvider`, `SocketProvider`)
- **自定义Hook**: 使用 `use` 前缀加上 **PascalCase** (例如: `useUser`, `useSocket`)

## API 路径

- 使用 **kebab-case**，全小写 (例如: `/api/question-sets`, `/api/user-progress`)
- 使用复数名词表示资源集合 (例如: `/users`, `/question-sets`)
- 使用ID路径参数表示特定资源 (例如: `/users/{userId}`, `/question-sets/{setId}`)
- 使用HTTP方法表示操作，避免在URL中使用动词

## 数据库表和列

- 表名和列名使用 **snake_case**，全小写
- 表名使用复数形式 (例如: `users`, `question_sets`)
- 主键统一使用 `id`
- 外键使用 `[关联表单数]_id` (例如: `user_id`, `question_set_id`)
- 布尔列使用 `is_` 或 `has_` 前缀 (例如: `is_admin`, `has_access`)
- 时间戳列使用 `created_at`, `updated_at`

## CSS 类名

- 使用 **kebab-case** (例如: `header-container`, `primary-button`)
- 如果使用BEM，遵循 `[block]__[element]--[modifier]` 模式
- 项目主要使用 Tailwind CSS，自定义类名较少，但若有，应遵循上述规则

## 命名示例

### 良好的命名示例:

```typescript
// 组件
function UserProfile() { ... }

// 变量
const userName = 'admin';
const isLoading = true;
const API_TIMEOUT = 5000;

// 函数
function getUserById(id: string) { ... }
function handleSubmit() { ... }

// 类和接口
interface UserProfile { ... }
class AuthService { ... }

// 文件名
// UserProfile.tsx, api-client.ts, auth-service.ts
```

### 不良的命名示例:

```typescript
// 避免使用非描述性名称
const x = 'admin';           // 应该使用 userName
const flag = true;           // 应该使用 isLoading
const do_something = () => { ... }  // 应该使用 handleSubmit

// 避免混合命名风格
const UserName = 'admin';    // 应该使用 userName (camelCase)
const get_user = () => { ... }  // 应该使用 getUser (camelCase)

// 避免缩写 (除非广泛接受)
const uName = 'admin';       // 应该使用 userName
const calcTtl = () => { ... }  // 应该使用 calculateTotal
```

## ESLint 和 Prettier 配置

项目使用 ESLint 和 Prettier 来强制执行代码风格。配置文件为 `.eslintrc.js` 和 `.prettierrc.js`。

使用以下命令检查和修复代码风格:

```bash
# 检查代码风格
npm run lint

# 自动修复代码风格问题
npm run lint:fix

# 格式化代码
npm run format
```

## 提交前检查

使用 Husky 和 lint-staged 确保提交前的代码符合风格规范。 