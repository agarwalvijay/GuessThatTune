import 'song.dart';

class Participant {
  final String id;
  final String name;

  Participant({required this.id, required this.name});

  factory Participant.fromJson(Map<String, dynamic> json) {
    return Participant(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
    };
  }
}

class GameSession {
  final String id;
  final String status;
  final List<Song> songs;
  final List<String> participantIds;
  final List<Participant>? participants;
  final Map<String, int> scores;
  final int currentRoundIndex;
  final GameSettings settings;

  GameSession({
    required this.id,
    required this.status,
    required this.songs,
    required this.participantIds,
    this.participants,
    required this.scores,
    required this.currentRoundIndex,
    required this.settings,
  });

  factory GameSession.fromJson(Map<String, dynamic> json) {
    return GameSession(
      id: json['id'] ?? '',
      status: json['status'] ?? 'waiting',
      songs: (json['songs'] as List?)
              ?.map((s) => Song.fromJson(s as Map<String, dynamic>))
              .toList() ??
          [],
      participantIds:
          (json['participantIds'] as List?)?.cast<String>() ?? [],
      participants: (json['participants'] as List?)
          ?.map((p) => Participant.fromJson(p as Map<String, dynamic>))
          .toList(),
      scores: Map<String, int>.from(json['scores'] ?? {}),
      currentRoundIndex: json['currentRoundIndex'] ?? -1,
      settings: GameSettings.fromJson(json['settings'] ?? {}),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'status': status,
      'songs': songs.map((s) => s.toJson()).toList(),
      'participantIds': participantIds,
      'participants': participants?.map((p) => p.toJson()).toList(),
      'scores': scores,
      'currentRoundIndex': currentRoundIndex,
      'settings': settings.toJson(),
    };
  }
}

class GameSettings {
  final int songDuration;
  final int numberOfSongs;

  GameSettings({
    required this.songDuration,
    required this.numberOfSongs,
  });

  factory GameSettings.fromJson(Map<String, dynamic> json) {
    return GameSettings(
      songDuration: json['songDuration'] ?? 30,
      numberOfSongs: json['numberOfSongs'] ?? 10,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'songDuration': songDuration,
      'numberOfSongs': numberOfSongs,
    };
  }
}
