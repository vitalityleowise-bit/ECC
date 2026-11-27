// Captures microphone audio to a temporary file. Asks for permission first.
// Live streaming to the backend (real STT) is wired in a later step; for now
// the app records a clip and the backend runs in mock mode.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:record/record.dart';

class VoiceRecorder {
  VoiceRecorder({AudioRecorder? recorder})
      : _recorder = recorder ?? AudioRecorder();

  final AudioRecorder _recorder;

  Future<bool> hasPermission() => _recorder.hasPermission();

  Future<bool> start(String filePath) async {
    if (!await _recorder.hasPermission()) return false;
    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000),
      path: filePath,
    );
    return true;
  }

  /// Stops recording and returns the file path of the clip, or null.
  Future<String?> stop() => _recorder.stop();

  Future<void> dispose() => _recorder.dispose();
}

final voiceRecorderProvider = Provider<VoiceRecorder>((ref) {
  final recorder = VoiceRecorder();
  ref.onDispose(recorder.dispose);
  return recorder;
});
