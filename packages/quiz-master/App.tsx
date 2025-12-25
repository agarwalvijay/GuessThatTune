import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SpotifyLoginScreen } from './src/screens/SpotifyLoginScreen';
import { PlaylistSelectionScreen } from './src/screens/PlaylistSelectionScreen';
import { GameSetupScreen } from './src/screens/GameSetupScreen';
import { GameControlScreen } from './src/screens/GameControlScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { spotifyAuthService } from './src/services/SpotifyAuthService';
import { useAppStore } from './src/store/appStore';

type RootStackParamList = {
  Login: undefined;
  PlaylistSelection: undefined;
  GameSetup: undefined;
  GameControl: undefined;
  Results: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await spotifyAuthService.isAuthenticated();
    setAuthenticated(authenticated);
    setIsCheckingAuth(false);
  };

  if (isCheckingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={isAuthenticated ? 'PlaylistSelection' : 'Login'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#191414' },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Login">
            {(props) => (
              <SpotifyLoginScreen
                {...props}
                onLoginSuccess={() => props.navigation.replace('PlaylistSelection')}
              />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="PlaylistSelection">
              {(props) => (
                <PlaylistSelectionScreen
                  {...props}
                  onPlaylistSelected={() => props.navigation.navigate('GameSetup')}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="GameSetup">
              {(props) => (
                <GameSetupScreen
                  {...props}
                  onGameStarted={() => {
                    console.log('Game started!');
                    props.navigation.navigate('GameControl');
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="GameControl">
              {(props) => (
                <GameControlScreen
                  {...props}
                  onGameEnded={() => {
                    console.log('Game ended!');
                    props.navigation.navigate('Results');
                  }}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Results">
              {(props) => (
                <ResultsScreen
                  {...props}
                  onStartNewGame={() => {
                    console.log('Starting new game!');
                    // Reset game session
                    const store = useAppStore.getState();
                    store.setGameSession(null);
                    // Reset navigation stack to PlaylistSelection
                    props.navigation.reset({
                      index: 0,
                      routes: [{ name: 'PlaylistSelection' }],
                    });
                  }}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#191414',
  },
});

export default App;
