import SQLite from 'react-native-sqlite-storage';
import * as RNFS from 'react-native-fs';
import {checkDatabaseExists} from './database';


const gachaDataFilePath = `${RNFS.DocumentDirectoryPath}/gacha_data.db`;

const openDatabase = async (filePath) => {
  try {
    const db = await SQLite.openDatabase({
      name: filePath,
      location: 'default',
    });
    return db;
  } catch (error) {
    throw new Error('数据库打开失败: ' + error);
  }
};


export const getPlayerUIDs = async () => {
  const db = await openDatabase(gachaDataFilePath);
  const isDatabaseExists = await checkDatabaseExists(gachaDataFilePath);
  if (!isDatabaseExists) {
    throw new Error('数据文件不存在，请先同步数据');
  }

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT DISTINCT player_id FROM gacha_logs`, // 获取所有UID
        [],
        (tx, results) => {
          const uids = [];
          for (let i = 0; i < results.rows.length; i++) {
            uids.push(results.rows.item(i).player_id);
          }
          resolve(uids);
        },
        (tx, error) => {
          console.error('SQL查询失败:', error);
          reject('查询失败: ' + error.message);
        }
      );
    });
  });
};

export const getGachaDataByUID = async (uid) => {
  const db = await openDatabase(gachaDataFilePath);

  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM gacha_logs WHERE player_id = ? ORDER BY id DESC`, // 倒序查询
        [uid],
        (tx, results) => {
          const rows = [];
          for (let i = 0; i < results.rows.length; i++) {
            rows.push(results.rows.item(i));
          }
          resolve(rows);
        },
        (tx, error) => {
          console.error('SQL查询失败:', error);
          reject('查询失败: ' + error.message);
        }
      );
    });
  });
};
