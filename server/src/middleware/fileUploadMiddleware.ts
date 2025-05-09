import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

console.log('[FileUpload] Upload directory configured:', uploadDir);

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('[FileUpload] Processing file upload:', file.originalname);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log('[FileUpload] Generated filename:', filename);
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept multiple file formats
  console.log('[FileUpload] File filter checking:', file.originalname, file.mimetype);
  
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
};

// Create the multer instance
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
}); 