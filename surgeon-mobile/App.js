/**
 * surgeon-on-call/surgeon-mobile/App.js
 *
 * ROOT APP COMPONENT
 * Manages global login state and persists surgeon session using AsyncStorage.
 *
 * On startup:
 *   - Checks AsyncStorage for a saved surgeon session
 *   - If found → goes straight to main app (no login needed)
 *   - If not found → shows login screen
 *
 * surgeonId is the single source of truth for which surgeon is logged in.
 * It is passed down to all screens that need it.
 */

import { registerRootComponent } from 'expo';
import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Navigation from './src/lib/navigation';

// AsyncStorage key where we save the logged-in surgeon's data
const STORAGE_KEY = 'surgeon_session';

function App() {
  // Whether the surgeon is logged in
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // The real surgeon ID from the database — replaces DEV_SURGEON_ID
  const [surgeonId, setSurgeonId] = useState(null);

  // Show a blank screen while we check AsyncStorage on startup
  const [loading, setLoading] = useState(true);

  // ── CHECK SAVED SESSION ON STARTUP ────────────────────────────────────────
  // When the app opens, check if a surgeon was already logged in.
  // If yes, restore their session automatically.
  useEffect(() => {
    const checkSession = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const session = JSON.parse(saved);
          console.log('App: Restored session for surgeon:', session.surgeon_id);
          setSurgeonId(session.surgeon_id);
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error('App: Failed to restore session:', err.message);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // ── HANDLE LOGIN ───────────────────────────────────────────────────────────
  // Called by LoginScreen after successful login.
  // Saves the session to AsyncStorage so it persists across app restarts.
  const handleLogin = async (surgeon) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        surgeon_id: surgeon.surgeon_id,
        name:       surgeon.name,
        phone:      surgeon.phone,
      }));
      setSurgeonId(surgeon.surgeon_id);
      setIsLoggedIn(true);
      console.log('App: Logged in as:', surgeon.name);
    } catch (err) {
      console.error('App: Failed to save session:', err.message);
    }
  };

  // ── HANDLE LOGOUT ──────────────────────────────────────────────────────────
  // Called by ProfileScreen when surgeon taps Log Out.
  // Clears AsyncStorage and resets state.
  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setSurgeonId(null);
      setIsLoggedIn(false);
      console.log('App: Logged out');
    } catch (err) {
      console.error('App: Failed to clear session:', err.message);
    }
  };

  // ── WAIT FOR SESSION CHECK ─────────────────────────────────────────────────
  // Don't render anything until we've checked AsyncStorage.
  // This prevents a flash of the login screen on every app open.
  if (loading) return null;

  return (
    <>
      <StatusBar style="light" />
      <Navigation
        isLoggedIn={isLoggedIn}
        surgeonId={surgeonId}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    </>
  );
}

registerRootComponent(App);
export default App;