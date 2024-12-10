import CryptoJS from 'crypto-js';
import { writeFile, readFile, exists, mkdir, stat } from 'react-native-fs';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNFS from "react-native-fs";
import * as base64js from 'base64-js';

// 获取文件时间戳
async function getFileTimestamp(filePath) {
  try {
    const fileExists = await exists(filePath);
    if (!fileExists) {
      return null;  // 文件不存在时，直接返回 null
    }

    const stats = await stat(filePath);
    return stats.mtimeMs;  // 返回文件修改时间（单位：毫秒）
  } catch (error) {
    console.error('获取文件时间戳失败:', error);
    return null;
  }
}
// 生成随机的 32 字节密钥
function generateSecretKey() {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);  // 生成 32 字节的密钥
}

// 加密函数
function encrypt(text, secretKey) {
  const iv = CryptoJS.lib.WordArray.random(16);  // 随机生成初始化向量
  const encrypted = CryptoJS.AES.encrypt(text, CryptoJS.enc.Hex.parse(secretKey), { iv });
  return { encryptedText: encrypted.toString(), iv: iv.toString(CryptoJS.enc.Hex) };
}

// 解密函数
function decrypt(encryptedText, secretKey, iv) {
  const ivHex = CryptoJS.enc.Hex.parse(iv);
  const decrypted = CryptoJS.AES.decrypt(encryptedText, CryptoJS.enc.Hex.parse(secretKey), { iv: ivHex });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

const CONFIG_DIR = `${RNFS.DocumentDirectoryPath}/key`;

// 存储加密配置到本地
async function saveSyncConfigToFile(repoUrl, token) {
  const secretKey = generateSecretKey();  // 自动生成随机密钥

  // 加密 repoUrl 和 token
  const { encryptedText: encryptedRepoUrl, iv: repoUrlIV } = encrypt(repoUrl, secretKey);
  const { encryptedText: encryptedToken, iv: tokenIV } = encrypt(token, secretKey);

  // 存储加密的配置和密钥
  const config = { encryptedRepoUrl, encryptedToken, repoUrlIV, tokenIV };
  const secretKeyFile = `${CONFIG_DIR}/secret_key.neko`;

  // 确保目录存在
  const dirExists = await exists(CONFIG_DIR);
  if (!dirExists) {
    await mkdir(CONFIG_DIR);
  }

  await writeFile(`${CONFIG_DIR}/neko_config.neko`, JSON.stringify(config));
  await writeFile(secretKeyFile, secretKey);

  console.log('配置和加密密码已保存');
}

// 从本地读取并解密配置和加密密码
async function loadSyncConfigFromFile() {
  const configFilePath = `${CONFIG_DIR}/neko_config.neko`;
  const secretKeyFilePath = `${CONFIG_DIR}/secret_key.neko`;

  if (await exists(configFilePath) && await exists(secretKeyFilePath)) {
    const configData = await readFile(configFilePath);
    const config = JSON.parse(configData);

    const secretKeyHex = await readFile(secretKeyFilePath);
    const secretKey = secretKeyHex;

    // 解密 repoUrl 和 token
    const decryptedRepoUrl = decrypt(config.encryptedRepoUrl, secretKey, config.repoUrlIV);
    const decryptedToken = decrypt(config.encryptedToken, secretKey, config.tokenIV);

    console.log('配置和加密密码已加载');
    return { decryptedRepoUrl, decryptedToken, secretKey };
  } else {
    console.error('配置文件或加密密码文件不存在');
    return null;
  }
}

// 获取仓库文件的时间戳
async function getFileTimestampFromRepo(repoUrl, token, fileName) {
  const { owner, repo, platform } = parseRepoUrl(repoUrl);
  let apiUrl;

  if (platform === 'gitee') {
    apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/commits?path=NekoGame/${fileName}`;
  } else if (platform === 'github') {
    apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=NekoGame/${fileName}`;
  } else {
    throw new Error('不支持的仓库平台');
  }

  try {
    let headers = {};
    if (platform === 'github') {
      headers['Authorization'] = `token ${token}`;
    }

    let params = {};
    if (platform === 'gitee') {
      params.access_token = token;
    }

    const response = await axios.get(apiUrl, { headers, params });
    if (response.data && response.data.length > 0) {
      const commitDate = response.data[0].commit.committer.date;
      return new Date(commitDate).getTime();
    } else {
      console.error('没有找到文件的提交记录');
      return null;
    }
  } catch (error) {
    console.error('获取文件时间戳失败:', error);
    return null;
  }
}

// 解析仓库 URL
function parseRepoUrl(repoUrl) {
  const giteeRegex = /https:\/\/gitee\.com\/([^\/]+)\/([^\/]+)/;
  const githubRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)/;
  let matches;

  if ((matches = repoUrl.match(giteeRegex))) {
    return { owner: matches[1], repo: matches[2], platform: 'gitee' };
  } else if ((matches = repoUrl.match(githubRegex))) {
    return { owner: matches[1], repo: matches[2], platform: 'github' };
  } else {
    throw new Error('无效的仓库 URL');
  }
}

async function autoDownloadFile(repoUrl, token, localFilePath, fileName) {
  const localFileTimestamp = await getFileTimestamp(localFilePath);  // 获取本地文件的时间戳

  if (localFileTimestamp === null) {
    console.log('本地文件不存在，直接下载...');
    await downloadFileFromRepo(repoUrl, token, fileName, localFilePath);
    return;
  }

  const repoFileTimestamp = await getFileTimestampFromRepo(repoUrl, token, fileName);  // 获取仓库中文件的时间戳

  if (repoFileTimestamp === null) {
    console.log('仓库中没有文件，无法下载');
    return;
  }

  const TIME_TOLERANCE = 60000; // 1分钟的时间容差
  const timeDiff = Math.abs(localFileTimestamp - repoFileTimestamp);

  if (timeDiff <= TIME_TOLERANCE) {
    console.log('本地文件和仓库中文件时间差异较小，无需下载');
  } else if (localFileTimestamp < repoFileTimestamp) {
    console.log('仓库中文件较新，准备下载...');
    await downloadFileFromRepo(repoUrl, token, fileName, localFilePath);
  } else {
    console.log('本地文件较新，无需下载');
  }
}

async function downloadFileFromRepo(repoUrl, token, fileName, localPath) {
  const { owner, repo, platform } = parseRepoUrl(repoUrl);  // 解析 repoUrl 获取 owner 和 repo
  let apiUrl;

  if (platform === 'gitee') {
    apiUrl = `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
  } else if (platform === 'github') {
    apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/NekoGame/${fileName}`;
  } else {
    throw new Error('不支持的仓库平台');
  }

  try {
    const headers = platform === 'github' ? {
      'Authorization': `Bearer ${token}`
    } : {};

    const response = await axios.get(apiUrl, {
      params: platform === 'gitee' ? { access_token: token } : {},
      headers: headers
    });

    // 检查返回的 response.data.content 是否是一个有效的 Base64 字符串
    if (response.data && response.data.content && typeof response.data.content === 'string') {
      const base64Content = response.data.content;

      // 确保 Base64 编码有效
      const base64Pattern = /^[A-Za-z0-9+/=]+$/;
      if (base64Pattern.test(base64Content)) {
        // 将文件内容从 Base64 转换并保存到本地
        const fileContent = base64js.toByteArray(base64Content);  // 使用 base64-js 进行转换

        // 将 Uint8Array 转换为 Base64 字符串（react-native-fs 需要的是字符串）
        const base64String = base64js.fromByteArray(fileContent);

        // 使用 Base64 字符串保存文件
        await writeFile(localPath, base64String, 'base64');
        console.log('文件下载成功:', fileName);
      } else {
        throw new Error('返回的内容不是有效的 Base64 编码');
      }
    } else {
      throw new Error('无法获取文件内容');
    }
  } catch (error) {
    console.error('文件下载失败:', error);
  }
}

// 保存 URL 和 Token 到 AsyncStorage
async function saveConfigToStorage(repoUrl, token, lastUpdated, gachaUpdated) {
  try {
    // 检查并处理空值
    const safeLastUpdated = lastUpdated ?? "";
    const safeGachaUpdated = gachaUpdated ?? "";
    await AsyncStorage.setItem('@repoUrl', repoUrl);
    await AsyncStorage.setItem('@token', token);
    await AsyncStorage.setItem('@lastUpdated', safeLastUpdated);
    await AsyncStorage.setItem('@gachaUpdated', safeGachaUpdated);
    console.log('配置已保存');
  } catch (error) {
    console.error('配置信息:', '信息保存失败', error);
  }
}


// 从 AsyncStorage 中读取 URL 和 Token
async function loadConfigFromStorage() {
  try {
    const repoUrl = await AsyncStorage.getItem('@repoUrl');
    const token = await AsyncStorage.getItem('@token');
    const lastUpdated = await AsyncStorage.getItem('@lastUpdated');
    const gachaUpdated = await AsyncStorage.getItem('@gachaUpdated');
    return { repoUrl, token, lastUpdated, gachaUpdated };
  } catch (error) {
    console.error('读取配置失败:', error);
    return null;
  }
}


module.exports = { getFileTimestampFromRepo, autoDownloadFile, loadConfigFromStorage, saveConfigToStorage }
