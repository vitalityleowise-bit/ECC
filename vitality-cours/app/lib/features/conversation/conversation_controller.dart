// State for one conversation: idle -> recording -> thinking -> replied/error.

import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../content/persona.dart';
import '../../services/backend_client.dart';
import '../../services/tutor_turn.dart';
import '../../services/voice_recorder.dart';

enum TurnPhase { idle, recording, thinking, replied, error }

@immutable
class ConversationState {
  const ConversationState({
    this.phase = TurnPhase.idle,
    this.lastTurn,
    this.errorMessage,
    this.micDenied = false,
  });

  final TurnPhase phase;
  final TutorTurn? lastTurn;
  final String? errorMessage;
  final bool micDenied;

  ConversationState copyWith({
    TurnPhase? phase,
    TutorTurn? lastTurn,
    String? errorMessage,
    bool? micDenied,
  }) {
    return ConversationState(
      phase: phase ?? this.phase,
      lastTurn: lastTurn ?? this.lastTurn,
      errorMessage: errorMessage,
      micDenied: micDenied ?? this.micDenied,
    );
  }
}

class ConversationController extends StateNotifier<ConversationState> {
  ConversationController({
    required this.ref,
    required this.targetLanguage,
    required this.level,
    required this.style,
  }) : super(const ConversationState());

  final Ref ref;
  final String targetLanguage;
  final Level level;
  final ConversationStyle style;

  String? _clipPath;

  Future<void> startRecording() async {
    final recorder = ref.read(voiceRecorderProvider);
    final dir = await getTemporaryDirectory();
    _clipPath =
        '${dir.path}/vc_${DateTime.now().millisecondsSinceEpoch}.m4a';
    final ok = await recorder.start(_clipPath!);
    if (!ok) {
      state = state.copyWith(phase: TurnPhase.idle, micDenied: true);
      return;
    }
    state = state.copyWith(phase: TurnPhase.recording, micDenied: false);
  }

  Future<void> stopAndSend() async {
    if (state.phase != TurnPhase.recording) return;
    final recorder = ref.read(voiceRecorderProvider);
    await recorder.stop();
    state = state.copyWith(phase: TurnPhase.thinking);

    // TODO(E5): send the recorded clip for real streaming speech-to-text.
    // Until then the backend runs in mock mode and we send a placeholder.
    const learnerText = '(voice clip - speech-to-text pending)';

    try {
      final turn = await ref.read(backendClientProvider).tutorTurn(
            targetLanguage: targetLanguage,
            level: level,
            style: style,
            learnerText: learnerText,
          );
      state = state.copyWith(phase: TurnPhase.replied, lastTurn: turn);
    } catch (err) {
      state = state.copyWith(
        phase: TurnPhase.error,
        errorMessage: err.toString(),
      );
    } finally {
      final path = _clipPath;
      if (path != null) {
        unawaited(File(path).delete().catchError((_) => File(path)));
      }
    }
  }
}

final conversationControllerProvider = StateNotifierProvider.autoDispose
    .family<ConversationController, ConversationState, ConversationArgs>(
  (ref, args) => ConversationController(
    ref: ref,
    targetLanguage: args.targetLanguage,
    level: args.level,
    style: args.style,
  ),
);

@immutable
class ConversationArgs {
  const ConversationArgs({
    required this.targetLanguage,
    required this.level,
    required this.style,
  });

  final String targetLanguage;
  final Level level;
  final ConversationStyle style;

  @override
  bool operator ==(Object other) =>
      other is ConversationArgs &&
      other.targetLanguage == targetLanguage &&
      other.level.id == level.id &&
      other.style.id == style.id;

  @override
  int get hashCode => Object.hash(targetLanguage, level.id, style.id);
}
