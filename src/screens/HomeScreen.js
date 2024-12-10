import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import * as RNFS from 'react-native-fs';
import { getFileTimestampFromRepo, autoDownloadFile, loadConfigFromStorage, saveConfigToStorage } from '../utils/fetchData';

const HomeScreen = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');  // 存储更新时间
  const [gachaUpdated, setGachaUpdated] = useState('');  // 存储更新时间

  const handleDownload = async () => {
    if (!repoUrl || !token) {
      Alert.alert('输入错误', '请填写仓库 URL 和 Token');
      return;
    }

    const nekoGame = 'neko_game.db';
    const gachaData = 'gacha_data.db';

    const gameTime = await getFileTimestampFromRepo(repoUrl, token, nekoGame);
    const gachaTime = await getFileTimestampFromRepo(repoUrl, token, gachaData);

    if (gameTime) {
      // 获取时间戳后加 8 小时
      const gameTimeWithOffset = new Date(gameTime);
      gameTimeWithOffset.setHours(gameTimeWithOffset.getHours() + 8);
      setLastUpdated(gameTimeWithOffset.toLocaleString());  // 显示更新时间
    }

    if (gachaTime) {
      // 获取时间戳后加 8 小时
      const gachaTimeWithOffset = new Date(gachaTime);
      gachaTimeWithOffset.setHours(gachaTimeWithOffset.getHours() + 8);
      setGachaUpdated(gachaTimeWithOffset.toLocaleString());  // 显示更新时间
    }

    const nekoGameFilePath = `${RNFS.DocumentDirectoryPath}/neko_game.db`;
    const gachaDataFilePath = `${RNFS.DocumentDirectoryPath}/gacha_data.db`;
    await saveConfigToStorage(repoUrl, token, lastUpdated, gachaUpdated); // 保存新数据
    // 下载 neko_game.db
    await autoDownloadFile(repoUrl, token, nekoGameFilePath, 'neko_game.db');

    // 下载 gacha_data.db
    await autoDownloadFile(repoUrl, token, gachaDataFilePath, 'gacha_data.db');

    Alert.alert('同步开始', '同步已完成');
  };

  const loadSavedConfig = async () => {
    const {repoUrl, token, lastUpdated, gachaUpdated } = await loadConfigFromStorage();
    if (repoUrl && token) {
      setRepoUrl(repoUrl);
      setToken(token);
      setLastUpdated(lastUpdated);
      setGachaUpdated(gachaUpdated);
    }
  };

  // 页面加载时调用
  useEffect(() => {
    loadSavedConfig();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>配置 URL</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入仓库 URL"
          value={repoUrl}
          onChangeText={setRepoUrl}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>配置 Token</Text>
        <TextInput
          style={styles.input}
          placeholder="请输入 Token"
          value={token}
          onChangeText={setToken}
          secureTextEntry
        />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="保存配置" onPress={() => saveConfigToStorage(repoUrl, token, lastUpdated, gachaUpdated)} />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="开始同步" onPress={handleDownload} />
      </View>

      {lastUpdated ? (
        <View style={styles.timeContainer}>
          <Text style={styles.text}>时长数据更新时间: </Text>
          <Text style={styles.timeText}>{lastUpdated}</Text>
        </View>
      ) : null}

      {gachaUpdated ? (
        <View style={styles.timeContainer}>
          <Text style={styles.text}>抽卡数据更新时间: </Text>
          <Text style={styles.timeText}>{gachaUpdated}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',  // 白色背景
    padding: 20,
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    height: 45,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    paddingLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  timeContainer: {
    marginTop: 10,
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 5,
  },
  timeText: {
    fontSize: 16,
    color: '#007bff', // 蓝色文字
    fontWeight: 'bold',
  },
});

export default HomeScreen;
