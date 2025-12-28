class SpotifyPlaylist {
  final String id;
  final String name;
  final String? imageUrl;
  final int trackCount;

  SpotifyPlaylist({
    required this.id,
    required this.name,
    this.imageUrl,
    required this.trackCount,
  });

  factory SpotifyPlaylist.fromJson(Map<String, dynamic> json) {
    final images = json['images'] as List?;
    String? imageUrl;
    if (images != null && images.isNotEmpty) {
      imageUrl = images[0]['url'];
    }

    return SpotifyPlaylist(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      imageUrl: imageUrl,
      trackCount: json['tracks']?['total'] ?? 0,
    );
  }
}
