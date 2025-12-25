import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { spotifyAuthService } from '../services/SpotifyAuthService';
import { apiService } from '../services/ApiService';
import { useAppStore } from '../store/appStore';

interface SpotifyLoginScreenProps {
  onLoginSuccess: () => void;
}

export const SpotifyLoginScreen: React.FC<SpotifyLoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const setAuthenticated = useAppStore((state) => state.setAuthenticated);
  const setError = useAppStore((state) => state.setError);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Authenticate with Spotify
      console.log('Starting Spotify authentication...');
      const tokens = await spotifyAuthService.authenticate();
      console.log('Spotify authentication successful, got tokens');

      // Fetch user profile
      console.log('Fetching user profile from backend...');
      const user = await apiService.getCurrentUser();
      console.log('User profile fetched:', user);

      // Update state
      setAuthenticated(true, user);

      // Call success callback
      onLoginSuccess();
    } catch (error) {
      console.error('Login error details:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Check if it's an axios error
      if ((error as any).response) {
        console.error('Response status:', (error as any).response.status);
        console.error('Response data:', (error as any).response.data);
      }
      const errorMessage = error instanceof Error ? error.message : 'Failed to login with Spotify';
      setError(errorMessage);
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Song Quiz Game</Text>
        <Text style={styles.subtitle}>Connect with Spotify to get started</Text>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Connect with Spotify</Text>
              <Text style={styles.buttonSubtext}>Spotify Premium required</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.infoText}>
          You'll be asked to authorize the app to access your Spotify playlists
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414', // Spotify black
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1DB954', // Spotify green
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#B3B3B3',
    marginBottom: 48,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonSubtext: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  infoText: {
    color: '#B3B3B3',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
