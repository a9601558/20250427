# 项目清理计划

## 清理日期：2025年11月9日

## 一、根目录冗余文件清理

### 🗑️ 可以删除的文件

#### 1. 测试数据文件
- `AWS-SAP-中文_完整题库_20251109_001255_answers_fixed.json` - 临时测试用题库数据（1.8MB）
  - **理由**：应该放在 `server/test-data/` 或完全删除
  - **操作**：删除（已导入数据库）

#### 2. 临时文档文件
- `PRODUCTION_SERVER_UPDATE.md` - 临时更新说明
  - **理由**：内容应该整合到 `docs/deployment/` 目录中
  - **操作**：整合后删除

- `PROFILE_DELETE_PROGRESS.md` - 功能说明文档
  - **理由**：应该移动到 `docs/features/` 目录
  - **操作**：移动到 `docs/features/ProfileDeleteProgress.md`

#### 3. 冗余配置文件
- `api-path-mapping.conf` - API路径映射配置
- `api-proxy-settings.conf` - API代理设置
- `nginx-headers-only.conf` - Nginx头部配置
- `nginx.conf` - Nginx配置
  - **理由**：应该统一放在 `docs/deployment/nginx/` 或 `server/config/nginx/`
  - **操作**：移动到 `docs/deployment/nginx/`

#### 4. 启动脚本
- `start.sh` - 启动脚本
  - **理由**：应该放在 `scripts/` 目录
  - **操作**：移动到 `scripts/start.sh`

---

## 二、docs目录重组

### 📁 建议的目录结构

```
docs/
├── README.md                          # 文档索引
├── CLEANUP_REPORT.md                  # 保留（历史记录）
├── GIT_COMMIT_GUIDE.md               # 保留
├── PROJECT_COMPLETION_SUMMARY.md     # 保留
├── model-associations.md             # 保留
│
├── features/                          # 功能文档
│   ├── API_SPEC.md
│   ├── COGNITO_POPUP_LOGIN.md
│   ├── JSON_IMPORT_FEATURE.md
│   ├── ProfileDeleteProgress.md      # 新增
│   ├── PURCHASE_MANAGEMENT.md        # 从根目录移动
│   ├── JSON题库导入说明.md
│   └── JSON题库导入-数据库字段映射详解.md
│
├── deployment/                        # 部署文档
│   ├── AWS_COGNITO_PRODUCTION_DEPLOYMENT.md
│   ├── MIGRATION_GUIDE.md
│   ├── PRODUCTION_DEPLOYMENT_GUIDE.md
│   ├── baota-deploy-guide.md
│   └── nginx/                        # 新建
│       ├── api-path-mapping.conf
│       ├── api-proxy-settings.conf
│       ├── nginx-headers-only.conf
│       └── nginx.conf
│
├── production/                        # 生产环境文档
│   ├── PRODUCTION_DEPLOYMENT_GUIDE_JP.md
│   ├── PRODUCTION_ENV_SETUP.md
│   └── PRODUCTION_READY_REPORT.md
│
├── fix-records/                      # 修复记录（整理）
│   ├── JSON题库显示问题修复总结.md
│   ├── JSON题库顺序问题完整修复记录.md
│   ├── 选项标签重复问题修复.md
│   ├── 选项编号顺序修复.md
│   ├── 题目顺序显示问题修复.md
│   └── 题目顺序问题最终修复.md
│
└── security/                         # 新建
    └── SECURITY_INCIDENT_RESPONSE.md

```

### 🗑️ 可以归档的文档（移动到 docs/archive/）

这些文档记录了已完成的bug修复，可以归档但保留：
- `docs/fix-records/` 下的所有文件（整个目录可以重命名为 `archive/fix-records/`）

---

## 三、server目录清理

### 🗑️ 可以删除的文件

- `server/fix-featured-categories.js` - 一次性修复脚本
  - **理由**：已执行完成的临时脚本
  - **操作**：删除或移动到 `server/scripts/maintenance/`

### 📝 文档整合

- `server/COGNITO_ENV_SETUP.md` → 合并到 `docs/deployment/AWS_COGNITO_PRODUCTION_DEPLOYMENT.md`
- `server/DATABASE.md` → 移动到 `docs/database/DATABASE.md`
- `server/DEPLOYMENT.md` → 合并到 `docs/deployment/PRODUCTION_DEPLOYMENT_GUIDE.md`
- `server/README-register.md` → 合并到 `server/README.md` 或删除

---

## 四、代码清理

### 1. 移除已弃用的代码

#### src/services/api.ts
```typescript
// Line 335 - 移除或更新弃用警告
console.warn('[API] getQuestionCount is deprecated, use getBatchQuestionCounts instead');
```

**建议**：如果 `getQuestionCount` 已经不使用，直接删除该方法

### 2. 清理 TODO 注释

检查并处理以下文件中的 TODO：
- `src/components/RedeemCodeAdmin.tsx` (line 112)
- `src/services/CognitoAuthService.ts` (lines 13, 61, 220)
- `server/src/controllers/purchaseController.ts` (line 480)

### 3. 修复硬编码的域名

**文件**：
- `src/components/OIDCAuth.tsx` (line 116)
- `src/contexts/OIDCUserContext.tsx` (line 261)

```typescript
// 当前（硬编码）
const cognitoDomain = "https://ap-northeast-106lr5s5h9.auth.ap-northeast-1.amazoncognito.com";

// 建议（使用配置）
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || 
  "https://ap-northeast-106lr5s5h9.auth.ap-northeast-1.amazoncognito.com";
```

---

## 五、Git清理

### 清理 .DS_Store 文件
```bash
find . -name ".DS_Store" -type f -delete
echo ".DS_Store" >> .gitignore
git add .gitignore
git commit -m "🧹 chore: Add .DS_Store to gitignore and remove existing files"
```

---

## 六、执行步骤

### Phase 1: 文档整理（安全操作）
1. ✅ 创建必要的新目录
2. ✅ 移动文件到正确位置
3. ✅ 更新文档内的引用链接
4. ✅ 提交：`git commit -m "📚 docs: Reorganize documentation structure"`

### Phase 2: 删除冗余文件
1. ✅ 删除已确认的冗余文件
2. ✅ 提交：`git commit -m "🗑️ chore: Remove redundant files"`

### Phase 3: 代码清理
1. ✅ 移除弃用的代码
2. ✅ 处理 TODO 注释
3. ✅ 修复硬编码值
4. ✅ 提交：`git commit -m "♻️ refactor: Clean up deprecated code and TODOs"`

### Phase 4: 最终清理
1. ✅ 清理 .DS_Store
2. ✅ 运行测试确保没有破坏功能
3. ✅ 提交：`git commit -m "✨ chore: Final cleanup and optimization"`

---

## 七、清理后预期效果

### 文件减少
- 根目录：从 9 个配置/文档文件减少到 2 个（README.md + ecosystem.config.js）
- 文档更有组织性和可维护性
- 代码更清晰，移除了弃用和未使用的代码

### 预估空间节省
- 删除测试数据：~1.8 MB
- 移除冗余文档和配置：~100 KB
- 总计：~2 MB

### 维护性提升
- 文档结构清晰，易于查找
- 减少混淆和重复内容
- 更好的项目组织

---

## 八、注意事项

⚠️ **重要提醒**：
1. 执行删除操作前，确保进行 Git 提交
2. 保留所有有历史价值的文档（移动到 archive/ 而不是删除）
3. 更新所有文档引用链接
4. 测试应用确保没有破坏功能

---

## 九、回滚计划

如果清理后出现问题：
```bash
# 回滚最后一次提交
git reset --hard HEAD~1

# 或者回滚到特定提交
git reset --hard <commit-hash>
```

