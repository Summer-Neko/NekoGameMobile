import * as RNFS from 'react-native-fs';
import SQLite from 'react-native-sqlite-storage';

// 获取数据库路径
const nekoGameFilePath = `${RNFS.DocumentDirectoryPath}/neko_game.db`;

SQLite.enablePromise(true);  // 开启 Promise API

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

// 检查数据库文件是否存在
export const checkDatabaseExists = async (filePath) => {
  const exists = await RNFS.exists(filePath);
  return exists;
};

// 获取所有游戏数据
export const getGames = async () => {
  // 检查数据库是否存在
  const isDatabaseExists = await checkDatabaseExists(nekoGameFilePath);
  if (!isDatabaseExists) {
    throw new Error('数据文件不存在，请先同步数据');
  }

  return new Promise((resolve, reject) => {
    openDatabase(nekoGameFilePath).then((db) => {
      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM games',
          [],
          (tx, results) => {
            const games = [];
            for (let i = 0; i < results.rows.length; i++) {
              games.push(results.rows.item(i));
            }
            resolve(games);
          },
          (err) => reject('获取游戏数据失败: ' + err)
        );
      });
    }).catch((err) => reject(err));
  });
};

// 获取最近半年的游戏会话数据
export const getGameSessionsByGameId = async (gameId) => {
  // 检查数据库是否存在
  const isDatabaseExists = await checkDatabaseExists(nekoGameFilePath);
  if (!isDatabaseExists) {
    throw new Error('数据库文件不存在，请先同步数据');
  }

  return new Promise((resolve, reject) => {
    openDatabase(nekoGameFilePath).then((db) => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const formattedDate = sixMonthsAgo.toISOString().split('T')[0]; // 格式化日期为 YYYY-MM-DD

      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM game_sessions WHERE game_id = ? AND start_time >= ? ORDER BY start_time DESC',
          [gameId, formattedDate],
          (tx, results) => {
            const sessions = [];
            for (let i = 0; i < results.rows.length; i++) {
              sessions.push(results.rows.item(i));
            }
            resolve(sessions);  // 返回所有会话记录
          },
          (err) => reject('获取游戏会话数据失败: ' + err)
        );
      });
    }).catch((err) => reject(err));
  });
};

// 获取某个游戏的总时长
export const getTotalTimeForGame = async (gameId) => {
  const db = await openDatabase(nekoGameFilePath);
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT SUM(duration) AS total_time FROM game_sessions WHERE game_id = ?',
        [gameId],
        (tx, results) => {
          const totalTime = results.rows.item(0).total_time || 0;
          resolve(totalTime);
        },
        (err) => reject('获取游戏总时长失败: ' + err)
      );
    });
  });
};

// 获取游戏名称和图标的函数
export const getGameInfoById = async (gameId) => {
  const db = await openDatabase(nekoGameFilePath);
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT name, icon FROM games WHERE id = ?',
        [gameId],
        (tx, results) => {
          if (results.rows.length > 0) {
            resolve(results.rows.item(0)); // 返回游戏的名称和图标
          } else {
            reject('游戏信息未找到');
          }
        },
        (err) => reject('获取游戏信息失败: ' + err)
      );
    });
  });
};
