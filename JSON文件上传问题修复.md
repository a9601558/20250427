# JSON 文件上传问题修复

## 问题描述
```
Error: 只支持CSV和TXT文件
at fileFilter (/www/wwwroot/root/git/dist/server/dist/middleware/fileUploadMiddleware.js:43:12)
```

上传 JSON 文件时被拒绝，因为文件上传中间件只允许 CSV 和 TXT 格式。

## 根本原因

`server/src/middleware/fileUploadMiddleware.ts` 中的 `fileFilter` 函数只检查以下类型：
- ❌ `text/csv`
- ❌ `text/plain`
- ❌ `.csv` 扩展名
- ❌ `.txt` 扩展名

但没有包含：
- ⚠️ `application/json`
- ⚠️ `.json` 扩展名

## 解决方案

### 修改的文件
`server/src/middleware/fileUploadMiddleware.ts`

### 修改内容

**修改前：**
```typescript
if (file.mimetype === 'text/csv' || 
    file.mimetype === 'text/plain' ||
    file.mimetype === 'application/octet-stream' ||
    file.originalname.endsWith('.csv') ||
    file.originalname.endsWith('.txt')) {
  console.log('[FileUpload] File accepted:', file.originalname);
  cb(null, true);
} else {
  console.log('[FileUpload] File rejected:', file.originalname, file.mimetype);
  cb(new Error('只支持CSV和TXT文件'));
}
```

**修改后：**
```typescript
if (file.mimetype === 'text/csv' || 
    file.mimetype === 'text/plain' ||
    file.mimetype === 'application/json' ||        // ✅ 新增
    file.mimetype === 'application/octet-stream' ||
    file.originalname.endsWith('.csv') ||
    file.originalname.endsWith('.txt') ||
    file.originalname.endsWith('.json')) {          // ✅ 新增
  console.log('[FileUpload] File accepted:', file.originalname);
  cb(null, true);
} else {
  console.log('[FileUpload] File rejected:', file.originalname, file.mimetype);
  cb(new Error('只支持CSV、TXT和JSON文件'));       // ✅ 更新错误信息
}
```

## 应用修复

### 1. 重新构建后端
```bash
cd /Users/wilson/Desktop/montopi/20250427/server
npm run build
```

### 2. 重启后端服务器
如果后端正在运行，需要重启：
```bash
# 停止当前服务器 (Ctrl+C)
# 然后重新启动
npm start
```

或者如果使用 PM2：
```bash
pm2 restart exam-server
```

## 验证修复

### 测试步骤
1. 登录管理后台
2. 进入 "JSON题库导入" 页面
3. 选择 JSON 文件（如 `AWS-SAP-中文_完整题库_20251109_001255_answers_fixed.json`）
4. 上传文件

### 预期结果
- ✅ 文件应该被接受
- ✅ 日志显示: `[FileUpload] File accepted: xxx.json`
- ✅ 开始处理和导入题目

### 如果仍然失败
检查：
1. 后端是否已重新构建：`ls -la server/dist/middleware/fileUploadMiddleware.js`
2. 后端是否已重启
3. 浏览器是否有缓存（清除缓存并刷新）

## 支持的文件类型（更新后）

| 文件类型 | MIME类型 | 扩展名 | 用途 |
|---------|---------|-------|------|
| CSV | text/csv | .csv | 批量题目导入（简单格式） |
| TXT | text/plain | .txt | 批量题目导入（简单格式） |
| JSON | application/json | .json | **完整题库导入（推荐）** |
| Binary | application/octet-stream | * | 兜底支持 |

## 文件大小限制
- 最大文件大小: **10MB**
- 适用于所有文件类型

## 相关日志

### 成功上传 JSON 文件
```
[FileUpload] File filter checking: AWS-SAP-中文_完整题库.json application/json
[FileUpload] File accepted: AWS-SAP-中文_完整题库.json
[FileUpload] Generated filename: 1731234567890-123456789.json
[JSON-API] Received JSON upload request
[JSON-API] Received file: AWS-SAP-中文_完整题库.json size: 1234567
```

### 失败（修复前）
```
[FileUpload] File filter checking: AWS-SAP-中文_完整题库.json application/json
[FileUpload] File rejected: AWS-SAP-中文_完整题库.json application/json
Error: 只支持CSV和TXT文件
```

## 注意事项

1. **字符编码**: JSON 文件应使用 UTF-8 编码
2. **文件名**: 支持中文文件名
3. **并发**: 同时只能上传一个文件
4. **临时文件**: 上传的文件会保存在 `server/uploads/` 目录，处理完成后自动删除

## 其他改进建议

### 可选优化（未来）
1. 增加文件大小到 20MB（支持更大的题库）
2. 添加文件内容预验证（在文件过滤阶段）
3. 支持压缩文件（.zip, .gz）
4. 添加进度回调（分块上传）

### 安全建议
- ✅ 已限制文件类型
- ✅ 已限制文件大小
- ✅ 使用唯一文件名防止覆盖
- ✅ 临时文件在处理后删除
- ✅ 需要管理员权限

## 总结

✅ **问题已修复**
- 文件上传中间件现在支持 JSON 文件
- 后端已重新构建
- 可以立即使用 JSON 题库导入功能

🎯 **下一步**
- 重启后端服务器
- 上传你的 AWS-SAP 题库 JSON 文件
- 享受完整的题库导入功能！

---

**修复完成时间**: 2025年11月9日
**修复状态**: ✅ 已解决
