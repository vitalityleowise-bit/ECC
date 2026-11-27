import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../content/persona.dart';
import 'conversation_controller.dart';

/// Conversation screen: an animated avatar placeholder, a press-to-talk mic,
/// and the tutor's reply with correction and tip.
class ConversationScreen extends ConsumerWidget {
  const ConversationScreen({
    super.key,
    required this.style,
    required this.level,
    required this.targetLanguage,
  });

  final ConversationStyle style;
  final Level level;
  final String targetLanguage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uiLang = context.locale.languageCode;
    final args = ConversationArgs(
      targetLanguage: targetLanguage,
      level: level,
      style: style,
    );
    final state = ref.watch(conversationControllerProvider(args));
    final controller = ref.read(conversationControllerProvider(args).notifier);

    final recording = state.phase == TurnPhase.recording;
    final thinking = state.phase == TurnPhase.thinking;

    return Scaffold(
      appBar: AppBar(title: Text(style.label.resolve(uiLang))),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  _Avatar(active: recording || thinking),
                  const SizedBox(height: 16),
                  Text(
                    thinking
                        ? '...'
                        : recording
                            ? 'listening'.tr()
                            : 'your_turn'.tr(),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 20),
                  if (state.micDenied)
                    _InfoCard(
                      color: Colors.orange.shade50,
                      icon: Icons.mic_off,
                      text: 'Microphone permission needed.',
                    ),
                  if (state.phase == TurnPhase.error)
                    _InfoCard(
                      color: Colors.red.shade50,
                      icon: Icons.error_outline,
                      text: state.errorMessage ?? 'Error',
                    ),
                  if (state.lastTurn != null) ...[
                    _ReplyCard(
                      title: '',
                      text: state.lastTurn!.reply,
                      icon: Icons.record_voice_over,
                    ),
                    _ReplyCard(
                      title: 'correction'.tr(),
                      text: state.lastTurn!.wasCorrect
                          ? 'ok'
                          : state.lastTurn!.correction,
                      icon: Icons.spellcheck,
                    ),
                    if (state.lastTurn!.tip.isNotEmpty)
                      _ReplyCard(
                        title: '',
                        text: state.lastTurn!.tip,
                        icon: Icons.lightbulb_outline,
                      ),
                  ],
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 32),
            child: Column(
              children: [
                GestureDetector(
                  onTapDown: (_) => controller.startRecording(),
                  onTapUp: (_) => controller.stopAndSend(),
                  onTapCancel: controller.stopAndSend,
                  child: CircleAvatar(
                    radius: 44,
                    backgroundColor: recording
                        ? Theme.of(context).colorScheme.secondary
                        : Theme.of(context).colorScheme.primary,
                    child: Icon(
                      recording ? Icons.mic : Icons.mic_none,
                      color: Colors.white,
                      size: 40,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text('speak'.tr()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Placeholder avatar: a pulsing ring while the tutor listens or talks.
/// Swapped for a real animated avatar (Ready Player Me / Unity) in a later step.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      width: active ? 140 : 120,
      height: active ? 140 : 120,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(colors: [scheme.primary, scheme.secondary]),
        boxShadow: active
            ? [BoxShadow(color: scheme.secondary.withOpacity(0.5), blurRadius: 24)]
            : null,
      ),
      child: const Icon(Icons.school, color: Colors.white, size: 56),
    );
  }
}

class _ReplyCard extends StatelessWidget {
  const _ReplyCard({required this.title, required this.text, required this.icon});

  final String title;
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Icon(icon),
        title: title.isEmpty ? null : Text(title),
        subtitle: Text(text, style: const TextStyle(fontSize: 16)),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.color, required this.icon, required this.text});

  final Color color;
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color,
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(leading: Icon(icon), title: Text(text)),
    );
  }
}
