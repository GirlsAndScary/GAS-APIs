// app.js

// 初始化js
const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const app = express();
const port = 8080;

// API 版本号
const apiVersion = '1.0.0';

// 状态标签
const S01 = "OK";
const S02 = "Error";
const S03 = "Api Tokens Are Required";

// 读取sql.json
const configPath = 'data/sql.json';
let rawdata = fs.readFileSync(configPath);
let config = JSON.parse(rawdata);

// 读取apikeys.json
const readApiKeys = () => {
    const data = fs.readFileSync('data/apikeys.json');
    return JSON.parse(data).validApiKeys;
};

// 创建 MySQL 连接池
const pool = mysql.createPool({
    connectionLimit: config.connectionLimit,
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.database
});

// 修改X-Powered-By标头
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'NyaC API Supprot');
    next();
});

// 使用 body-parser 中间件解析 JSON 请求体
app.use(bodyParser.json());

//  ----结束初始化程序----

// 定义消息函数
function readMessageFromFile() {
    const filePath = path.join(__dirname, 'data', 'data.json');
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return data.message;
    } catch (err) {
        return 'ErrorInMessageFromFile'; // 当读取文件失败时的默认消息
    }
}

// 定义时间函数
function formatCurrentTime() {
    const currentTime = new Date();
    const year = currentTime.getFullYear();
    const month = String(currentTime.getMonth() + 1).padStart(2, '0'); 
    const day = String(currentTime.getDate()).padStart(2, '0');
    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const seconds = String(currentTime.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 定义日志打印函数
function printLog(req, api_path) {
    const disabledLogPath = path.join(__dirname, 'data', 'setting.disabledLog');
    try {
        if (fs.existsSync(disabledLogPath)) {
            return; 
        }
    } catch(err) {
        console.error('Error while checking for disabled.log:', err);
    }
    
    const xForwardedFor = req.headers['x-forwarded-for'];
    const ip = xForwardedFor ? xForwardedFor.split(',')[0].trim() : req.connection.remoteAddress;
    const currentTime = formatCurrentTime();
    
    console.log(`VisitorIP: ${ip} Time: ${currentTime} Path: ${api_path}`);
}

// 根目录请求端点
app.get('/', (req, res) => {
    const currentTime = formatCurrentTime();
    const messageFromFile = readMessageFromFile();
    res.json({
        status: S01,
        currentTime: currentTime,
        apiVersion: apiVersion,
        message: messageFromFile
    });
    printLog(req, '/');
});

app.get('/public/getIP', (req, res) => {
    const currentTime = formatCurrentTime();
    const messageFromFile = readMessageFromFile();
    const xForwardedFor = req.headers['x-forwarded-for'];
    const ip = xForwardedFor ? xForwardedFor.split(',')[0].trim() : req.connection.remoteAddress;
    res.json({
        status: S01,
        currentTime: currentTime,
        apiVersion: apiVersion,
        message: messageFromFile,
        visitorIP: ip
    });
    printLog(req, '/public/getIP');
});

// 时间请求端点
app.get('/public/time', (req, res) => {
    const currentTime = formatCurrentTime();
    res.json({
        status: S01,
        currentTime: currentTime,
        apiVersion: apiVersion
    });
    printLog(req, '/public/time');
});

// 根据ID查询data字段的请求端点
app.get('/public/res/getByID/:id', (req, res) => {
    const id = req.params.id;
    // 查询数据库
    pool.getConnection((err, connection) => {
        if (err) {
            return res.status(404).json({
                status: S02,
                currentTime: currentTime,
                apiVersion: apiVersion,
                message: 'Error getting connection'
            });
        }
        // Table 名称
        // 组合 SQL 查询字符串
        const queryTemplate = 'SELECT data FROM ';
        const tableName = config.table;
        const whereClause = ' WHERE id = ?;';
        const query = queryTemplate + tableName + whereClause;
        connection.query(query, [id], (err, results) => {
            connection.release();
            const currentTime = formatCurrentTime();
            if (err) {
                return res.status(404).json({
                    status: S02,
                    currentTime: currentTime,
                    apiVersion: apiVersion,
                    message: 'Error executing query'
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    status: S02,
                    currentTime: currentTime,
                    apiVersion: apiVersion,
                    message: 'No data found with given ID'
                });
            }
            res.json({
                status: S01,
                currentTime: currentTime,
                apiVersion: apiVersion,
                message: {
                    id: id,
                    data: results[0].data
                }
            });
        });
    });
    printLog(req, `/public/res/getByID/${id}`);
});

// 处理POST请求的/api路径
app.post('/private/testkey', (req, res) => {
    const userApiKey = req.body.apikey;
    const validApiKeys = readApiKeys();
    const currentTime = formatCurrentTime();

    // 检查是否包含 apikey
    if (!req.body || !req.body.apikey) {
        return res.status(400).json({
            status: S03,
            currentTime: currentTime,
            apiVersion: apiVersion,
            message: "Missing API Key."
        });
    }

    if (validApiKeys.includes(userApiKey)) {
        res.json({
            status: S01,
            currentTime: currentTime,
            apiVersion: apiVersion,
            message: "API Key Passed."
        });
    } else {
        res.status(401).json({
            status: S02,
            currentTime: currentTime,
            apiVersion: apiVersion,
            message: "API Key is not correct."
        });
    }
    printLog(req, '/private/testkey');
});

// 不存在错误请求端点
app.use((req, res, next) => {
    const currentTime = formatCurrentTime();
    res.status(404).json({
        status: S02,
        currentTime: currentTime,
        apiVersion: apiVersion,
        message: 'API endpoint not found'
    });
    printLog(req, '404');
});

// 启动服务器，监听端口
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
    const disabledLogPath = path.join(__dirname, 'data', 'setting.disabledLog');
    try {
        if (fs.existsSync(disabledLogPath)) {
            console.log("Find 'setting.disabledLog' ConsoleLog was disabled.")
        }
    } catch(err) {
        console.error('Error while checking for setting.disabledLog:', err);
    }
});
