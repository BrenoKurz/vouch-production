import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { palette } from '@/constants/design';
import { useNotifications } from '@/providers/notification-provider';

function tabIcon(
  name: React.ComponentProps<typeof Ionicons>['name'],
  activeName: React.ComponentProps<typeof Ionicons>['name'],
  color: ColorValue,
  size: number,
  focused: boolean,
) {
  return (
    <Ionicons
      color={color as string}
      name={focused ? activeName : name}
      size={size}
    />
  );
}

export default function TabsLayout() {
  const { unreadCount } = useNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: palette.canvas,
        },
        headerTitleStyle: {
          color: palette.ink,
          fontSize: 18,
          fontWeight: '700',
        },
        tabBarActiveTintColor: palette.brand,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: palette.subtle,
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon('home-outline', 'home', color, size, focused),
        }}
      />

      <Tabs.Screen
        name="introductions"
        options={{
          title: 'Introductions',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon('sparkles-outline', 'sparkles', color, size, focused),
        }}
      />

      <Tabs.Screen
        name="dates"
        options={{
          title: 'Dates',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon('calendar-outline', 'calendar', color, size, focused),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge:
            unreadCount > 0
              ? unreadCount > 99
                ? '99+'
                : unreadCount
              : undefined,
          tabBarBadgeStyle: {
            backgroundColor: palette.brand,
            color: palette.white,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon(
              'notifications-outline',
              'notifications',
              color,
              size,
              focused,
            ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) =>
            tabIcon('person-outline', 'person', color, size, focused),
        }}
      />
    </Tabs>
  );
}
