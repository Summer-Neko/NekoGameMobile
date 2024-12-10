import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Modal, Button, ActivityIndicator } from 'react-native';
import { getGames, getGameSessionsByGameId, getTotalTimeForGame, getGameInfoById } from '../utils/database';
import { LineChart } from 'react-native-chart-kit';

const GameTimeScreen = () => {
  const [games, setGames] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [selectedGame, setSelectedGame] = useState(null); // 当前选中的游戏
  const [modalVisible, setModalVisible] = useState(false); // 弹窗显示控制
  const [gameSessions, setGameSessions] = useState([]); // 游戏的会话数据
  const [loadingSessions, setLoadingSessions] = useState(false); // 加载会话数据动画

  // 加载游戏数据
  const loadData = async () => {
    try {
      const gamesData = await getGames();  // 获取所有游戏数据
      setGames(gamesData);

      // 计算总时长
      const total = gamesData.reduce((acc, game) => acc + game.total_time, 0);
      setTotalTime(total);
    } catch (err) {
      console.error('加载数据失败:', err);
      Alert.alert('加载失败', '无法加载游戏数据，请重试');
    }
  };

  // 加载选中游戏的详细数据
  const loadGameDetails = async (gameId) => {
    try {
      const gameInfo = await getGameInfoById(gameId);

      // 获取会话记录
      setLoadingSessions(true); // 开始显示加载动画
      const sessions = await getGameSessionsByGameId(gameId); // 获取所有数据

      // 更新已加载的会话记录
      setGameSessions(sessions);

      // 计算近两周每日平均时间
      const calculateAvgTimeForLastTwoWeeks = (sessions) => {
        const dateSet = new Set();
        let totalTime = 0;
        let daysCount = 0;

        sessions.forEach((session) => {
          const sessionDate = session.start_time.split(' ')[0];
          if (!dateSet.has(sessionDate)) {
            dateSet.add(sessionDate);
            daysCount++;
          }
          totalTime += session.duration;
        });

        return daysCount > 0 ? (totalTime / 3600 / daysCount).toFixed(2) : 0;
      };

      const avgTime = calculateAvgTimeForLastTwoWeeks(sessions);

      // 更新选中的游戏
      setSelectedGame({
        ...gameInfo,
        sessions,
        totalTime: await getTotalTimeForGame(gameId),
        avgTime,
      });

      setModalVisible(true); // 打开弹窗
    } catch (err) {
      console.error('加载游戏详细数据失败:', err);
      Alert.alert('加载失败', '无法加载游戏详细数据');
    } finally {
      setLoadingSessions(false); // 隐藏加载动画
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 渲染每个游戏的卡片
  const renderGameCard = (game) => (
    <View style={styles.gameCard}>
      <Text style={styles.gameName}>{game.name}</Text>
      <Text style={styles.gameTime}>{(game.total_time / 3600).toFixed(2)} 小时</Text>
      <Button title={`查看 ${game.name} 的详细数据`} onPress={() => loadGameDetails(game.id)} />
    </View>
  );

  // 渲染详细弹窗
  const renderGameDetailsModal = () => {
    if (!selectedGame) return null;
    // 获取所有会话数据
    const sessions = selectedGame.sessions;

    // 生成最近 14 天的日期
    const today = new Date();
    today.setHours(today.getHours() + 8); // 强制调整为 UTC+8
    const past14Days = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      return date.toISOString().split('T')[0]; // 格式化为 YYYY-MM-DD
    }).reverse();

    // 按日期计算每日总时长
    const dailyDurations = past14Days.map((date) => {
      const totalDurationForDate = sessions
        .filter((session) => session.start_time.split(' ')[0] === date) // 筛选同一天的会话
        .reduce((sum, session) => sum + session.duration, 0); // 累计时长

      return totalDurationForDate / 3600; // 转换为小时
    });

    const startDate = past14Days[0].slice(5); // 只保留 MM-DD
    const endDate = past14Days[past14Days.length - 1].slice(5); // 只保留 MM-DD

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false);
          setGameSessions([]); // 清空数据
        }}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{selectedGame.name} - 游戏详细数据</Text>
          <Text style={styles.text}>总时长: {(selectedGame.totalTime / 3600).toFixed(2)} 小时</Text>
          <Text style={styles.text}>近两周每日平均时间: {selectedGame.avgTime} 小时</Text>
          <Text style={styles.subTitle}>从 {startDate} 到 {endDate}</Text>

          {/* 图表区域 */}
          <LineChart
            data={{
              labels: past14Days, // 显示日期
              datasets: [
                {
                  data: dailyDurations, // 每天的总游戏时长
                  color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`, // 蓝色
                },
                {
                  data: new Array(dailyDurations.length).fill(selectedGame.avgTime), // 平均时间线
                  color: (opacity = 1) => `rgba(255, 99, 132, ${opacity * 0.4})`, // 淡红色
                  withDots: false, // 不显示点
                },
              ],
            }}
            width={350}
            height={220}
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              color: (opacity = 1) => `rgba(0, 123, 255, ${opacity})`,
              labelColor: () => 'transparent',
              style: { borderRadius: 16 },
            }}
            style={{ marginVertical: 8, borderRadius: 16 }}
            onDataPointClick={(data) => {
              const date = past14Days[data.index]; // 获取日期
              const value = dailyDurations[data.index]; // 获取时长
              Alert.alert(`日期: ${date}`, `时长: ${value.toFixed(2)} 小时`);
            }}
          />

          {/* 游戏的启动时间列表 */}
          {loadingSessions ? (
            <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 20 }} />
          ) : (
            <FlatList
              data={gameSessions}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.sessionItem}>
                  <Text>开始时间: {item.start_time}</Text>
                  <Text>结束时间: {item.end_time || '今天'}</Text>
                  <Text>时长: {(item.duration / 60).toFixed(2)} 分钟</Text>
                </View>
              )}
            />
          )}

          <Button title="关闭" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>游戏时间</Text>

      <View style={styles.summaryContainer}>
        <Text style={styles.totalTimeText}>总游戏时长：{(totalTime / 3600).toFixed(2)} 小时</Text>
        <FlatList
          data={games.sort((a, b) => b.total_time - a.total_time)}  // 按时长排序
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => renderGameCard(item)}
        />
      </View>

      {renderGameDetailsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
  summaryContainer: { marginBottom: 30 },
  totalTimeText: { fontSize: 18, color: '#007bff', marginBottom: 20, textAlign: 'center' },
  gameCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  gameName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  gameTime: { fontSize: 16, color: '#555', marginBottom: 10 },
  modalContainer: { flex: 1, padding: 20, backgroundColor: '#fff' },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 18,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  sessionItem: {
    backgroundColor: '#f8f8f8',
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
});

export default GameTimeScreen;
