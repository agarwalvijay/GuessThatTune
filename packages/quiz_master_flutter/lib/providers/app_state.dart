import 'package:flutter/foundation.dart';

class AppState with ChangeNotifier {
  bool _isAuthenticated = false;
  String? _accessToken;
  String? _sessionId;

  bool get isAuthenticated => _isAuthenticated;
  String? get accessToken => _accessToken;
  String? get sessionId => _sessionId;

  void setAuthenticated(bool value, {String? token}) {
    _isAuthenticated = value;
    _accessToken = token;
    notifyListeners();
  }

  void setSessionId(String? id) {
    _sessionId = id;
    notifyListeners();
  }

  void reset() {
    _isAuthenticated = false;
    _accessToken = null;
    _sessionId = null;
    notifyListeners();
  }
}
