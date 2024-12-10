import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './screens/HomeScreen';   // 导入主页组件
import GameTimeScreen from './screens/GameTimeScreen'; // 游戏时长页面
import GachaAnalysisScreen from './screens/GachaScreen'; // 抽卡数据页面

// 底部导航
const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="数据设置" component={HomeScreen} />
        <Tab.Screen name="游戏时长" component={GameTimeScreen} />
        <Tab.Screen name="抽卡数据" component={GachaAnalysisScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
