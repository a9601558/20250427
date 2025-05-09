"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure upload directory exists
const uploadDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
console.log('[FileUpload] Upload directory configured:', uploadDir);
// Configure storage
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        console.log('[FileUpload] Processing file upload:', file.originalname);
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path_1.default.extname(file.originalname);
        console.log('[FileUpload] Generated filename:', filename);
        cb(null, filename);
    }
});
// File filter
const fileFilter = (req, file, cb) => {
    // Accept multiple file formats
    console.log('[FileUpload] File filter checking:', file.originalname, file.mimetype);
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'text/plain' ||
        file.mimetype === 'application/octet-stream' ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.txt')) {
        console.log('[FileUpload] File accepted:', file.originalname);
        cb(null, true);
    }
    else {
        console.log('[FileUpload] File rejected:', file.originalname, file.mimetype);
        cb(new Error('只支持CSV和TXT文件'));
    }
};
// Create the multer instance
exports.upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max file size
    }
});
