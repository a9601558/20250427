// 重启服务器脚本
import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('准备重启服务器...');

// 检查服务器进程
const checkProcess = () => {
  return new Promise((resolve) => {
    exec('ps aux | grep node | grep server | grep -v grep', (error, stdout, stderr) => {
      if (error) {
        console.log('没有找到运行中的服务器进程');
        resolve(false);
        return;
      }
      
      if (stdout.trim()) {
        console.log('找到运行中的服务器进程:');
        console.log(stdout.trim());
        resolve(true);
      } else {
        console.log('没有找到运行中的服务器进程');
        resolve(false);
      }
    });
  });
};

// 停止服务器进程
const stopServer = () => {
  return new Promise((resolve) => {
    exec('pkill -f "node.*server"', (error, stdout, stderr) => {
      if (error) {
        console.log('停止服务器进程时出错，可能已经停止');
      } else {
        console.log('服务器进程已停止');
      }
      
      // 等待一段时间确保进程完全停止
      setTimeout(resolve, 2000);
    });
  });
};

// 编译 TypeScript 文件
const compileTypeScript = () => {
  return new Promise((resolve, reject) => {
    console.log('编译服务器代码...');
    
    const serverDir = path.join(__dirname, 'server');
    
    // 检查 package.json 是否存在
    if (!fs.existsSync(path.join(serverDir, 'package.json'))) {
      console.error('找不到server/package.json，无法编译');
      reject(new Error('找不到package.json'));
      return;
    }
    
    // 执行npm run build或tsc命令
    const buildCmd = spawn('npm', ['run', 'build'], { cwd: serverDir, shell: true });
    
    buildCmd.stdout.on('data', (data) => {
      console.log(`编译输出: ${data}`);
    });
    
    buildCmd.stderr.on('data', (data) => {
      console.error(`编译错误: ${data}`);
    });
    
    buildCmd.on('close', (code) => {
      if (code === 0) {
        console.log('TypeScript编译成功');
        resolve();
      } else {
        console.error(`TypeScript编译失败，退出码 ${code}`);
        reject(new Error(`编译失败，退出码 ${code}`));
      }
    });
  });
};

// 启动服务器
const startServer = () => {
  return new Promise((resolve) => {
    console.log('启动服务器...');
    
    const serverDir = path.join(__dirname, 'server');
    const serverProcess = spawn('node', ['dist/index.js'], { 
      cwd: serverDir,
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    
    // 分离子进程
    serverProcess.unref();
    
    console.log('服务器已在后台启动');
    resolve();
  });
};

// 主函数
const main = async () => {
  try {
    // 检查进程
    const isRunning = await checkProcess();
    
    // 如果服务器正在运行，停止它
    if (isRunning) {
      await stopServer();
    }
    
    // 编译 TypeScript
    await compileTypeScript();
    
    // 启动服务器
    await startServer();
    
    console.log('服务器已重启，修复应该已生效');
    console.log('请刷新网页查看效果');
  } catch (error) {
    console.error('重启服务器时出错:', error);
  }
};

// 执行主函数
main(); 
