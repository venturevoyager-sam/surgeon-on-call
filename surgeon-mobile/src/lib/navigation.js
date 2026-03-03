// surgeon-on-call/surgeon-mobile/src/lib/navigation.js
//
// NAVIGATION — Controls which screens the surgeon sees
//
// There are two navigation stacks:
//
// 1. AUTH STACK — shown when surgeon is NOT logged in
//    └── LoginScreen
//
// 2. MAIN STACK — shown when surgeon IS logged in
//    ├── Bottom Tab Bar
//    │   ├── Home tab → HomeScreen
//    │   ├── Earnings tab → EarningsScreen
//    │   └── Profile tab → ProfileScreen
//    └── RequestDetailScreen (slides up on top of tabs when surgeon taps a request)
//
// App.js controls which stack is shown by passing isLoggedIn prop.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';


// ── SCREEN IMPORTS ─────────────────────────────────────────────────────────────
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import RequestDetailScreen from '../screens/RequestDetailScreen';
import EarningsScreen from '../screens/EarningsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AcceptedCaseScreen from '../screens/AcceptedCaseScreen';

// ── NAVIGATORS ─────────────────────────────────────────────────────────────────
// Stack navigator: screens slide in/out horizontally
const Stack = createStackNavigator();

// Tab navigator: bottom tab bar with icons
const Tab = createBottomTabNavigator();

// ── TAB ICON COMPONENT ─────────────────────────────────────────────────────────
// Simple emoji icons for the bottom tab bar.
// Replace with proper icons later using @expo/vector-icons if needed.
function TabIcon({ emoji, focused }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{
        fontSize: 22,
        // Slightly larger when the tab is active
        transform: [{ scale: focused ? 1.1 : 1.0 }],
      }}>
        {emoji}
      </Text>
    </View>
  );
}

// ── MAIN TABS ──────────────────────────────────────────────────────────────────
// The bottom tab bar shown when the surgeon is logged in.
// Contains: Home, Earnings, Profile
function MainTabs({ onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        // Hide the default header bar on all tab screens
        // Each screen has its own custom header built in
        headerShown: false,

        // Active tab colour — our brand blue
        tabBarActiveTintColor: '#1A56A0',

        // Inactive tab colour — muted gray
        tabBarInactiveTintColor: '#94A3B8',

        // Tab bar styling
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 4,
          height: 64,
        },

        // Tab label styling
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* ── HOME TAB ── */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* ── EARNINGS TAB ── */}
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
        }}
      />

      {/* ── PROFILE TAB ── */}
      <Tab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      >
        {/* Pass onLogout down to ProfileScreen so surgeon can log out */}
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>

    </Tab.Navigator>
  );
}

// ── MAIN NAVIGATION COMPONENT ──────────────────────────────────────────────────
// This is what App.js renders.
// Props:
//   isLoggedIn — boolean, controls which stack is shown
//   onLogin    — function, called when surgeon logs in successfully
//   onLogout   — function, called when surgeon logs out
export default function Navigation({ isLoggedIn, onLogin, onLogout }) {
  return (
    // NavigationContainer: wraps the entire navigation tree
    // Must be at the root of all navigation
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        {isLoggedIn ? (
          // ── LOGGED IN: Show main app ──────────────────────────────────────
          <>
            {/* Main tab bar — Home, Earnings, Profile */}
            <Stack.Screen name="MainTabs">
              {(props) => <MainTabs {...props} onLogout={onLogout} />}
            </Stack.Screen>

            {/* Request detail screen — slides up when surgeon taps a request card */}
            {/* Sits outside the tab bar so it covers the full screen */}
            <Stack.Screen
                name="RequestDetail"
                component={RequestDetailScreen}
                options={{ presentation: 'modal' }}
            />

            <Stack.Screen
                name="AcceptedCase"
                component={AcceptedCaseScreen}
                options={{ presentation: 'modal' }}
            />
          </>
        ) : (
          // ── NOT LOGGED IN: Show login screen ──────────────────────────────
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLogin={onLogin} />}
          </Stack.Screen>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}