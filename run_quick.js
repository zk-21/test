// 精简回测：仅输出关键指标
const fs = require("fs");
const path = require("path");

// 读取已打补丁的 v4.1
const code = fs.readFileSync(path.join(__dirname, "optimized_picker.js"), "utf-8");

// 在 runBacktest 函数末尾，汇总输出只保留关键指标
// 直接 eval（因为模块结构）
const { execSync } = require("child_process");

// 简化：直接命令行跑，输出重定向到文件
const result = execSync('node "c:\\Users\\61419\\Downloads\\selectBall-main\\optimized_picker.js"', {
  cwd: __dirname,
  encoding: "utf-8",
  timeout: 180000,
  maxBuffer: 10 * 1024 * 1024,
});

console.log(result);
