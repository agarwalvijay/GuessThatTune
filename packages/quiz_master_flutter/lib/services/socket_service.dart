import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/environment.dart';
import '../models/game_session.dart';

class SocketService {
  IO.Socket? _socket;
  String? _sessionId;
  final Map<String, List<Function>> _listeners = {};

  void connect() {
    if (_socket?.connected == true) {
      print('Socket already connected');
      return;
    }

    print('🔌 Connecting to socket server: ${AppConfig.backendUrl}');

    _socket = IO.io(
      AppConfig.backendUrl,
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)
          .build(),
    );

    _socket!.onConnect((_) {
      print('✅ Socket connected: ${_socket!.id}');

      // Rejoin session if we were in one
      if (_sessionId != null) {
        print('🔄 Auto-rejoining session: $_sessionId');
        joinSession(_sessionId!);
      } else {
        print('ℹ️  No session to rejoin');
      }
    });

    _socket!.onDisconnect((_) {
      print('❌ Socket disconnected');
    });

    _socket!.onConnectError((error) {
      print('Socket connection error: $error');
    });

    _setupEventListeners();
  }

  void _setupEventListeners() {
    if (_socket == null) return;

    _socket!.on('game_state_update', (data) {
      print('📡 Game state update: ${data['session']['status']}');
      print('   Participants: ${(data['session']['participantIds'] as List?)?.length ?? 0}');
      _emit('game_state_update', data['session']);
    });

    _socket!.on('participant_joined', (data) {
      print('👋 Participant joined: ${data['participant']['name']}');
      _emit('participant_joined', data['participant']);
    });

    _socket!.on('participant_left', (data) {
      print('👋 Participant left: ${data['participantId']}');
      _emit('participant_left', data['participantId']);
    });

    _socket!.on('buzzer_event', (data) {
      print('🔔 Buzzer event: ${data['buzzerEvent']['participantName']} at position ${data['position']}');
      _emit('buzzer_event', data);
    });

    _socket!.on('error', (data) {
      print('❌ Server error: ${data['message']}');
      _emit('error', data['message']);
    });
  }

  void joinSession(String sessionId) {
    _sessionId = sessionId;

    if (_socket == null) {
      print('⚠️ Socket not initialized, connecting first...');
      connect();
      return;
    }

    if (_socket!.connected == false) {
      print('⚠️ Socket not connected yet, will join when connection establishes');
      return;
    }

    print('📱 Emitting join_session_as_master for session: $sessionId');
    _socket!.emit('join_session_as_master', {'sessionId': sessionId});
  }

  void disconnect() {
    if (_socket != null) {
      print('🔌 Disconnecting socket');
      _socket!.disconnect();
      _socket = null;
      _sessionId = null;
      _listeners.clear();
    }
  }

  // Event emitter pattern for UI
  void on(String event, Function callback) {
    if (!_listeners.containsKey(event)) {
      _listeners[event] = [];
    }
    _listeners[event]!.add(callback);
  }

  void off(String event, Function callback) {
    _listeners[event]?.remove(callback);
  }

  void _emit(String event, dynamic data) {
    _listeners[event]?.forEach((callback) {
      callback(data);
    });
  }

  bool isConnected() {
    return _socket?.connected ?? false;
  }
}

final socketService = SocketService();
