import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { getGachaDataByUID, getPlayerUIDs } from '../utils/gacha_database';

const GACHA_TYPE_ORDER = [
  "角色活动唤取", "武器活动唤取", "角色常驻唤取",
  "武器常驻唤取", "新手唤取", "新手自选唤取",
  "感恩定向唤取"
];

const GachaScreen = () => {
  const [uids, setUIDs] = useState([]);
  const [selectedUID, setSelectedUID] = useState('');
  const [gachaData, setGachaData] = useState([]);
  const [selectedPool, setSelectedPool] = useState(GACHA_TYPE_ORDER[0]);
  const [filteredData, setFilteredData] = useState([]);
  const [viewMode, setViewMode] = useState('summary'); // 概览或详细模式
  const [isLoading, setIsLoading] = useState(false); // 控制加载动画

  useEffect(() => {
    loadUIDs();
  }, []);

  useEffect(() => {
    if (selectedUID) {
      loadGachaData(selectedUID);
    }
  }, [selectedUID]);

  useEffect(() => {
    if (selectedPool) {
      filterDataByPool();
    }
  }, [selectedPool, gachaData]);

  const loadUIDs = async () => {
    try {
      setIsLoading(true);
      const uids = await getPlayerUIDs();
      if (uids.length > 0) {
        setUIDs(uids);
        setSelectedUID(uids[0]); // 默认选择第一个UID
      } else {
        Alert.alert('提示', '未找到玩家UID，请先同步数据。');
      }
    } catch (error) {
      Alert.alert('错误', '加载UID失败，请稍后再试。');
    }finally {
      setIsLoading(false); // 隐藏加载动画
    }
  };

  const loadGachaData = async (uid) => {
    setIsLoading(true);
    try {
      const data = await getGachaDataByUID(uid);
      setGachaData(data);
    } catch (error) {
      Alert.alert('错误', '加载数据失败，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  };

  const filterDataByPool = useCallback(() => {
    const data = gachaData.filter((item) => item.card_pool_type === selectedPool);
    setFilteredData(data);
  }, [gachaData, selectedPool]);

  const calculateDrawsBetween = (records, quality) => {
    const qualityRecords = records.filter(r => r.quality_level === quality);
    if (qualityRecords.length === 0) return 0;
    let totalDraws = 0;
    qualityRecords.forEach((record, index) => {
      const nextIndex = index + 1 < qualityRecords.length
        ? records.indexOf(qualityRecords[index + 1])
        : records.length;
      totalDraws += nextIndex - records.indexOf(record);
    });
    return totalDraws / qualityRecords.length;
  };
    const getDrawColor = (draws, quality) => {
      if (quality === 5) {
        if (draws <= 35) return '#3399ff'; // 蓝色
        if (draws <= 67) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
      }
      if (quality === 4) {
        if (draws <= 3) return '#3399ff'; // 蓝色
        if (draws <= 7) return '#33cc33'; // 绿色
        return '#ff6666'; // 红色
      }
      return '#aaa'; // 默认灰色
    };

   const generateOverview = () => {
      const fiveStarRecords = filteredData.filter(r => r.quality_level === 5);
      return fiveStarRecords.map((record, index) => {
        const nextIndex = index + 1 < fiveStarRecords.length
          ? filteredData.indexOf(fiveStarRecords[index + 1])
          : filteredData.length;

        const draws = nextIndex - filteredData.indexOf(record);
        const progress = Math.min((draws / 80) * 100, 100); // 最大80抽

        return (
          <TouchableOpacity
            key={record.id}
            style={styles.record}
            activeOpacity={0.6} // 点击透明度变化
          >
            <Text style={[styles.recordText, { color: 'gold' }]}>
              {record.name} - {draws} 抽 ({record.timestamp})
            </Text>
            <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: getDrawColor(draws, 5) }]} />
          </TouchableOpacity>
        );
      });
    };

    const generateDetails = () => {
      const groupedData = filteredData.reduce((acc, record) => {
        const date = record.timestamp.split(' ')[0]; // 按日期分组
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(record);
        return acc;
      }, {});

      return Object.keys(groupedData).map((date) => (
        <View key={date} style={styles.detailGroup}>
          <Text style={styles.detailDate}>{date}</Text>
          {groupedData[date].map((record, index) => {
            const isFiveStar = record.quality_level === 5;
            const isFourStar = record.quality_level === 4;

            if (isFiveStar || isFourStar) {
              const nextIndex = index + 1 < groupedData[date].length
                ? groupedData[date].findIndex(
                    (r, i) => i > index && r.quality_level === record.quality_level
                  )
                : groupedData[date].length;
              const draws = nextIndex - index;

              return (
                <View key={record.id} style={styles.detailRecord}>
                  <Text style={[styles.recordText, { color: getDrawColor(draws, record.quality_level) }]}>
                    {record.name} ({record.quality_level}星) - {draws} 抽
                  </Text>
                </View>
              );
            } else {
              return (
                <View key={record.id} style={styles.detailRecord}>
                  <Text style={[styles.recordText, { color: '#aaa' }]}>
                    {record.name} ({record.quality_level}星)
                  </Text>
                </View>
              );
            }
          })}
        </View>
      ));
    };

  const calculateUpAverage = (records) => {
    const commonItems = ["安可", "卡卡罗", "凌阳", "鉴心", "维里奈"]; // 常驻角色
    const upRecords = records.filter(
      r => r.quality_level === 5 && !commonItems.includes(r.name) && r.card_pool_type === "角色活动唤取"
    );
    if (upRecords.length === 0) return 0;
    let totalDraws = 0;
    upRecords.forEach((record, index) => {
      const nextIndex = index + 1 < upRecords.length
        ? records.indexOf(upRecords[index + 1])
        : records.length;
      totalDraws += nextIndex - records.indexOf(record);
    });
    return totalDraws / upRecords.length;
  };

  const getAverageColor = (value, threshold1, threshold2) => {
    if (value < threshold1) return '#3399ff'; // 蓝色
    if (value <= threshold2) return '#33cc33'; // 绿色
    return '#ff6666'; // 红色
  };

  const renderAverageInfo = () => {
    const avgDraws = calculateDrawsBetween(filteredData, 5);
    const upAvgDraws =
      selectedPool === "角色活动唤取"
        ? calculateUpAverage(filteredData)
        : null;
    return (
      <View style={styles.averageContainer}>
        <View style={[styles.averageBlock, { backgroundColor: getAverageColor(avgDraws, 45, 65) }]}>
          <Text style={styles.averageText}>平均抽数: {avgDraws.toFixed(2)}</Text>
        </View>
        {upAvgDraws !== null && (
          <View style={[styles.averageBlock, { backgroundColor: getAverageColor(upAvgDraws, 55, 83) }]}>
            <Text style={styles.averageText}>平均UP: {upAvgDraws.toFixed(2)}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>选择玩家UID:</Text>
      <Picker
        selectedValue={selectedUID}
        onValueChange={(value) => setSelectedUID(value)}
        style={styles.picker}
      >
        {uids.map((uid) => (
          <Picker.Item key={uid} label={uid} value={uid} />
        ))}
      </Picker>

      <ScrollView horizontal style={styles.tabContainer}>
        {GACHA_TYPE_ORDER.map(pool => (
          <TouchableOpacity
            key={pool}
            onPress={() => setSelectedPool(pool)}
            style={[
              styles.tab,
              selectedPool === pool && styles.activeTab,
            ]}
            activeOpacity={0.7}
          >
            <Text style={selectedPool === pool ? styles.activeTabText : styles.tabText}>
              {pool}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 加载动画 */}
      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#007bff" />
        </View>
      ) : (
        <>
          {renderAverageInfo()}
          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[styles.switchButton, viewMode === 'summary' && styles.activeSwitchButton]}
              onPress={() => setViewMode('summary')}
              activeOpacity={0.8}
            >
              <Text style={styles.switchText}>概览</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchButton, viewMode === 'details' && styles.activeSwitchButton]}
              onPress={() => setViewMode('details')}
               activeOpacity={0.8}
            >
              <Text style={styles.switchText}>详细</Text>
            </TouchableOpacity>
          </View>

          {viewMode === 'summary' && (
            <ScrollView
              contentContainerStyle={styles.scrollViewContent}
              style={styles.scrollView}
            >
              {generateOverview()}
            </ScrollView>
          )}

          {viewMode === 'details' && (
            <ScrollView
              contentContainerStyle={styles.scrollViewContent}
              style={styles.scrollView}
            >
              {generateDetails()}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
};

export default GachaScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#333' },
  picker: {
    height: 50,
    width: '100%',
    marginBottom: 20,
    backgroundColor: '#333',
    color: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabContainer: { flexDirection: 'row', marginVertical: 15, maxHeight: 70 },
  scrollView: {
    flex: 1,
    marginBottom: 0, // 去掉底部多余间距
  },
  scrollViewContent: {
    paddingBottom: 0, // 内容的底部 padding 为 0
  },
  tab: {
    flex: 1,
    padding: 15,
    marginHorizontal: 5,
    backgroundColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 50,
    overflow: 'hidden',
  },
  activeTab: { backgroundColor: '#007bff' },
  tabText: { fontSize: 16, color: '#666', textAlign: 'center' },
  activeTabText: { color: '#fff', fontSize: 16 },
  subtitle: { fontSize: 16, fontWeight: '500', marginVertical: 15, color: '#444' },
  averageContainer: { flexDirection: 'row', marginBottom: 15 },
  averageBlock: {
    flex: 1,
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 50,
    backgroundColor: '#333',
  },
  averageText: { fontSize: 16, fontWeight: '600', color: '#fff', textAlign: 'center' },
  record: {
    width: '100%',
    padding: 15,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 80,
  },
  progressBar: { height: 10, borderRadius: 5, marginTop: 10 },
  recordText: { fontSize: 14, color: '#555', fontWeight: '500' },
  switchContainer: { flexDirection: 'row', marginVertical: 15 },
  switchButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 5,
    width: 120,
    height: 50,
  },
  activeSwitchButton: { backgroundColor: '#007bff' },
  switchText: { color: '#fff', fontSize: 16 },
  detailGroup: { marginBottom: 15 },
  detailDate: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#444' },
  detailRecord: {
    width: '100%',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    minHeight: 80,
  },
});



