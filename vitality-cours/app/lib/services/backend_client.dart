// Talks to the VITALITY COURS backend. The app never calls an AI provider
// directly; all keys stay on the server (see CLAUDE.md).

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../content/persona.dart';
import '../core/env.dart';
import 'tutor_turn.dart';

class BackendClient {
  BackendClient({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: Env.backendUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 30),
            ));

  final Dio _dio;

  Map<String, dynamic> _levelJson(Level level) => {
        'id': level.id,
        'label': level.label.values,
        'speakingRate': level.speakingRate,
        'correctionStrictness': level.correctionStrictness,
        'sentenceMaxWords': level.sentenceMaxWords,
      };

  Map<String, dynamic> _styleJson(ConversationStyle style) => {
        'id': style.id,
        'label': style.label.values,
        'goal': style.goal,
        'topics': style.topics,
      };

  Future<TutorTurn> tutorTurn({
    required String targetLanguage,
    required Level level,
    required ConversationStyle style,
    required String learnerText,
    String task = 'conversation',
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/tutor-turn',
      data: {
        'targetLanguage': targetLanguage,
        'level': _levelJson(level),
        'style': _styleJson(style),
        'learnerText': learnerText,
        'task': task,
      },
    );
    final data = response.data ?? const {};
    if (data['ok'] != true) {
      throw Exception('Backend error: ${data['error'] ?? 'unknown'}');
    }
    return TutorTurn.fromJson(data);
  }
}

final backendClientProvider = Provider<BackendClient>((ref) => BackendClient());
