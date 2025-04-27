const dotenv = require('dotenv');
const path = require('path');
const { exec } = require('child_process');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 设置开发环境，以确保可以使用alter模式
process.env.NODE_ENV = 'development';

// 强制表明要同步数据库
process.env.SYNC_DATABASE = 'true';

console.log('开始强制同步所有模型到数据库...');

// 我们需要运行TypeScript代码来同步模型，所以用ts-node
const syncProcess = exec('npx ts-node src/scripts/sync-all-models.ts', 
  { cwd: path.join(__dirname, '../..') }, 
  (error, stdout, stderr) => {
    if (error) {
      console.error(`执行出错: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  }
);

syncProcess.stdout.on('data', (data) => {
  console.log(data);
});

syncProcess.stderr.on('data', (data) => {
  console.error(data);
}); 