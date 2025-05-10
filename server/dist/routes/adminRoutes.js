"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const uuid_1 = require("uuid");
const QuestionSet_1 = __importDefault(require("../models/QuestionSet"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// 使用身份验证和管理员中间件
router.use(authMiddleware_1.protect);
router.use(authMiddleware_1.admin);
// 配置 multer 上传
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads/card-images');
        // 如果目录不存在则创建
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名
        const uniqueFilename = `${(0, uuid_1.v4)()}-${Date.now()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueFilename);
    }
});
// 文件过滤器，只接受图片
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    }
    else {
        cb(new Error('只允许上传图片文件'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB 限制
    }
});
/**
 * 上传题库卡片图片
 * @route POST /api/admin/upload/card-image
 */
router.post('/upload/card-image', (req, res) => {
    console.log('收到图片上传请求');
    // 使用 multer 中间件处理文件上传
    upload.single('image')(req, res, async (err) => {
        if (err) {
            console.error('图片上传错误:', err);
            if (err instanceof multer_1.default.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({
                        success: false,
                        message: '文件大小不能超过5MB'
                    });
                }
            }
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }
        // 检查是否有文件
        if (!req.file) {
            console.error('没有上传文件');
            return res.status(400).json({
                success: false,
                message: '未选择文件'
            });
        }
        try {
            console.log('文件已上传:', req.file);
            const { questionSetId } = req.body;
            console.log('题库ID:', questionSetId);
            if (!questionSetId) {
                // 如果没有题库ID，删除上传的文件
                fs_1.default.unlinkSync(req.file.path);
                return res.status(400).json({
                    success: false,
                    message: '题库ID不能为空'
                });
            }
            try {
                // 查找题库
                const questionSet = await QuestionSet_1.default.findByPk(questionSetId);
                if (!questionSet) {
                    // 如果题库不存在，删除上传的文件
                    fs_1.default.unlinkSync(req.file.path);
                    return res.status(404).json({
                        success: false,
                        message: '题库不存在'
                    });
                }
                // 获取图片的公共URL
                const relativePath = req.file.path.split('uploads/')[1];
                const imageUrl = `/uploads/${relativePath}`;
                // 如果之前有图片（非默认图标），删除它
                if (questionSet.icon && questionSet.icon !== 'default') {
                    try {
                        const previousPath = path_1.default.join(__dirname, '../../uploads', questionSet.icon.replace('/uploads/', ''));
                        if (fs_1.default.existsSync(previousPath)) {
                            fs_1.default.unlinkSync(previousPath);
                        }
                    }
                    catch (err) {
                        console.error('删除旧图片失败:', err);
                        // 即使删除失败也继续
                    }
                }
                // 更新题库，添加新的图片URL到icon字段
                await questionSet.update({ icon: imageUrl });
                return res.json({
                    success: true,
                    data: {
                        imageUrl: imageUrl,
                        questionSetId
                    },
                    message: '上传成功'
                });
            }
            catch (err) {
                console.error('保存图片URL到数据库失败:', err);
                // 数据库错误时删除上传的文件
                fs_1.default.unlinkSync(req.file.path);
                return res.status(500).json({
                    success: false,
                    message: '保存图片信息失败'
                });
            }
        }
        catch (error) {
            console.error('上传图片出错:', error);
            return res.status(500).json({
                success: false,
                message: '服务器错误'
            });
        }
    });
});
/**
 * 删除题库卡片图片
 * @route DELETE /api/admin/upload/card-image/:questionSetId
 */
router.delete('/upload/card-image/:questionSetId', async (req, res) => {
    try {
        const { questionSetId } = req.params;
        // 查找题库
        const questionSet = await QuestionSet_1.default.findByPk(questionSetId);
        if (!questionSet) {
            return res.status(404).json({
                success: false,
                message: '题库不存在'
            });
        }
        // 检查题库是否有自定义图片（非默认图标）
        if (!questionSet.icon || questionSet.icon === 'default') {
            return res.status(400).json({
                success: false,
                message: '题库没有自定义图片'
            });
        }
        // 删除图片文件
        try {
            const imagePath = path_1.default.join(__dirname, '../../uploads', questionSet.icon.replace('/uploads/', ''));
            if (fs_1.default.existsSync(imagePath)) {
                fs_1.default.unlinkSync(imagePath);
            }
        }
        catch (err) {
            console.error('删除图片文件失败:', err);
            // 即使文件删除失败也继续
        }
        // 更新题库，恢复默认图标
        await questionSet.update({ icon: 'default' });
        return res.json({
            success: true,
            message: '卡片图片删除成功'
        });
    }
    catch (error) {
        console.error('删除卡片图片出错:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});
exports.default = router;
