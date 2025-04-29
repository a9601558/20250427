const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('警告: 此操作将删除所有数据库表并重新创建。是否继续? (y/n) ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    console.log('开始强制同步所有模型...');
    
    // 使用ts-node执行同步脚本
    const syncProcess = exec('npx ts-node -e "import { syncAllModels } from \'./src/models/associations\'; syncAllModels().then(() => process.exit(0)).catch(() => process.exit(1));"',
      { cwd: process.cwd() }
    );

    // 输出同步过程
    syncProcess.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    syncProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    syncProcess.on('close', (code) => {
      if (code === 0) {
        console.log('同步完成!');
      } else {
        console.error('同步过程中出现错误!');
      }
      rl.close();
    });
  } else {
    console.log('操作已取消');
    rl.close();
  }
}); 