import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

function tabIcon(
  name: React.ComponentProps<typeof Ionicons>['name'],
  color: ColorValue,
  size: number,
) {
  return <Ionicons color={color as string} name={name} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: '#F7F4EF',
        },
        headerTitleStyle: {
          color: '#171717',
          fontSize: 18,
          fontWeight: '700',
        },
        tabBarActiveTintColor: '#352D28',
        tabBarInactiveTintColor: '#8F8881',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E6E0D9',
          height: 84,
          paddingBottom: 22,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) =>
            tabIcon('home-outline', color, size),
        }}
      />

      <Tabs.Screen
        name="introductions"
        options={{
          title: 'Introductions',
          tabBarIcon: ({ color, size }) =>
            tabIcon('sparkles-outline', color, size),
        }}
      />

      <Tabs.Screen
        name="dates"
        options={{
          title: 'Dates',
          tabBarIcon: ({ color, size }) =>
            tabIcon('calendar-outline', color, size),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) =>
            tabIcon('person-outline', color, size),
        }}
      />
    </Tabs>
  );
}
