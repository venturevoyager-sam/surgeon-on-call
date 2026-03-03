import { registerRootComponent } from 'expo';
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import Navigation from './src/lib/navigation';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  return (
    <>
      <StatusBar style="light" />
      <Navigation
        isLoggedIn={isLoggedIn}
        onLogin={() => setIsLoggedIn(true)}
        onLogout={() => setIsLoggedIn(false)}
      />
    </>
  );
}

registerRootComponent(App);
export default App;