const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { QuestionSet } = require('../../models');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/card-images');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueFilename = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

/**
 * Upload card image for a question set
 * @route POST /api/admin/upload/card-image
 */
const uploadCardImage = async (req, res) => {
  try {
    // Use multer middleware for file upload
    upload.single('image')(req, res, async (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
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
      
      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '未选择文件'
        });
      }
      
      const { questionSetId } = req.body;
      
      if (!questionSetId) {
        // Delete uploaded file if no question set ID
        fs.unlinkSync(req.file.path);
        
        return res.status(400).json({
          success: false,
          message: '题库ID不能为空'
        });
      }
      
      try {
        // Find question set
        const questionSet = await QuestionSet.findByPk(questionSetId);
        
        if (!questionSet) {
          // Delete uploaded file if question set not found
          fs.unlinkSync(req.file.path);
          
          return res.status(404).json({
            success: false,
            message: '题库不存在'
          });
        }
        
        // Get public URL for image
        const relativePath = req.file.path.split('uploads/')[1];
        const imageUrl = `/uploads/${relativePath}`;
        
        // If there was a previous image, delete it
        if (questionSet.cardImage) {
          try {
            const previousPath = path.join(
              __dirname, 
              '../../uploads', 
              questionSet.cardImage.replace('/uploads/', '')
            );
            
            if (fs.existsSync(previousPath)) {
              fs.unlinkSync(previousPath);
            }
          } catch (err) {
            console.error('删除旧图片失败:', err);
            // Continue even if deletion fails
          }
        }
        
        // Update question set with new image URL
        await questionSet.update({ cardImage: imageUrl });
        
        return res.json({
          success: true,
          data: {
            imageUrl: imageUrl,
            questionSetId
          },
          message: '上传成功'
        });
      } catch (err) {
        console.error('保存图片URL到数据库失败:', err);
        
        // Delete uploaded file on database error
        fs.unlinkSync(req.file.path);
        
        return res.status(500).json({
          success: false,
          message: '保存图片信息失败'
        });
      }
    });
  } catch (error) {
    console.error('上传图片出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * Delete card image for a question set
 * @route DELETE /api/admin/upload/card-image/:questionSetId
 */
const deleteCardImage = async (req, res) => {
  try {
    const { questionSetId } = req.params;
    
    // Find question set
    const questionSet = await QuestionSet.findByPk(questionSetId);
    
    if (!questionSet) {
      return res.status(404).json({
        success: false,
        message: '题库不存在'
      });
    }
    
    // Check if question set has an image
    if (!questionSet.cardImage) {
      return res.status(400).json({
        success: false,
        message: '题库没有卡片图片'
      });
    }
    
    // Delete image file
    try {
      const imagePath = path.join(
        __dirname, 
        '../../uploads', 
        questionSet.cardImage.replace('/uploads/', '')
      );
      
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (err) {
      console.error('删除图片文件失败:', err);
      // Continue even if file deletion fails
    }
    
    // Update question set to remove image URL
    await questionSet.update({ cardImage: null });
    
    return res.json({
      success: true,
      message: '卡片图片删除成功'
    });
  } catch (error) {
    console.error('删除卡片图片出错:', error);
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

module.exports = {
  uploadCardImage,
  deleteCardImage
}; 