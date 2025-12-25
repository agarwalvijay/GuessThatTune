import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SpotifyPlaylist } from '@song-quiz/shared';
import { apiService } from '../services/ApiService';
import { useAppStore } from '../store/appStore';

interface PlaylistSelectionScreenProps {
  onPlaylistSelected: () => void;
}

export const PlaylistSelectionScreen: React.FC<PlaylistSelectionScreenProps> = ({
  onPlaylistSelected,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const playlists = useAppStore((state) => state.playlists);
  const setPlaylists = useAppStore((state) => state.setPlaylists);
  const selectPlaylist = useAppStore((state) => state.selectPlaylist);
  const spotifyUser = useAppStore((state) => state.spotifyUser);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    setIsLoading(true);
    try {
      console.log('Loading playlists...');
      const fetchedPlaylists = await apiService.getPlaylists();
      console.log('Playlists loaded:', fetchedPlaylists.length, 'playlists');
      setPlaylists(fetchedPlaylists);
    } catch (error) {
      console.error('Error loading playlists:', error);
      if ((error as any).response) {
        console.error('Response status:', (error as any).response.status);
        console.error('Response data:', (error as any).response.data);
      }
      Alert.alert('Error', 'Failed to load playlists. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    try {
      setIsLoading(true);

      // Fetch tracks from the selected playlist
      const songs = await apiService.getPlaylistTracks(playlist.id);

      if (songs.length === 0) {
        Alert.alert('Empty Playlist', 'This playlist has no tracks. Please select another one.');
        return;
      }

      // Update state
      selectPlaylist(playlist);
      useAppStore.getState().setSongs(songs);

      // Navigate to game setup
      onPlaylistSelected();
    } catch (error) {
      console.error('Error selecting playlist:', error);
      Alert.alert('Error', 'Failed to load playlist tracks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPlaylistItem = ({ item }: { item: SpotifyPlaylist }) => {
    const imageUrl = item.images[0]?.url;

    return (
      <TouchableOpacity
        style={styles.playlistItem}
        onPress={() => handleSelectPlaylist(item)}
        disabled={isLoading}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.playlistImage} />
        ) : (
          <View style={styles.playlistImagePlaceholder}>
            <Text style={styles.playlistImagePlaceholderText}>♪</Text>
          </View>
        )}

        <View style={styles.playlistInfo}>
          <Text style={styles.playlistName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.playlistDetails}>
            {item.tracks.total} tracks • {item.owner.display_name}
          </Text>
        </View>

        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    );
  };

  if (isLoading && playlists.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.loadingText}>Loading your playlists...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select a Playlist</Text>
        {spotifyUser && (
          <Text style={styles.subtitle}>Welcome, {spotifyUser.display_name}!</Text>
        )}
      </View>

      <FlatList
        data={playlists}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No playlists found</Text>
            <TouchableOpacity onPress={loadPlaylists} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#191414',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#B3B3B3',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#B3B3B3',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#282828',
    borderRadius: 8,
  },
  playlistImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  playlistImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#404040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistImagePlaceholderText: {
    fontSize: 24,
    color: '#B3B3B3',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistDetails: {
    color: '#B3B3B3',
    fontSize: 13,
  },
  arrow: {
    color: '#B3B3B3',
    fontSize: 24,
    marginLeft: 8,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
