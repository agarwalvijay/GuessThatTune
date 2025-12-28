class Song {
  final String id;
  final String title;
  final String artist;
  final String album;
  final String spotifyUri;
  final String? previewUrl;
  final int durationMs;

  Song({
    required this.id,
    required this.title,
    required this.artist,
    required this.album,
    required this.spotifyUri,
    this.previewUrl,
    required this.durationMs,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    return Song(
      id: json['id'] ?? '',
      title: json['title'] ?? json['name'] ?? '',
      artist: json['artist'] ?? '',
      album: json['album'] ?? '',
      spotifyUri: json['spotifyUri'] ?? json['uri'] ?? '',
      previewUrl: json['previewUrl'],
      durationMs: json['durationMs'] ?? json['duration_ms'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'artist': artist,
      'album': album,
      'spotifyUri': spotifyUri,
      'previewUrl': previewUrl,
      'durationMs': durationMs,
    };
  }
}
