import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../content/persona.dart';

/// Conversation screen. This is the shell: the mic button, the transcript, and
/// the correction/pronunciation panels. The live voice pipeline (record ->
/// backend streaming STT -> LLM -> TTS) is wired in a later step, once the
/// backend and the owner's own API keys are in place. See CLAUDE.md.
class ConversationScreen extends StatefulWidget {
  const ConversationScreen({
    super.key,
    required this.style,
    required this.targetLanguage,
    required this.levelId,
  });

  final ConversationStyle style;
  final String targetLanguage;
  final String levelId;

  @override
  State<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends State<ConversationScreen> {
  bool _listening = false;

  @override
  Widget build(BuildContext context) {
    final uiLang = context.locale.languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(widget.style.label.resolve(uiLang))),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _listening ? 'listening'.tr() : 'your_turn'.tr(),
                  style: Theme.of(context).textTheme.headlineSmall,
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 40),
            child: GestureDetector(
              onTapDown: (_) => setState(() => _listening = true),
              onTapUp: (_) => setState(() => _listening = false),
              onTapCancel: () => setState(() => _listening = false),
              child: CircleAvatar(
                radius: 44,
                backgroundColor: _listening
                    ? Theme.of(context).colorScheme.secondary
                    : Theme.of(context).colorScheme.primary,
                child: Icon(
                  _listening ? Icons.mic : Icons.mic_none,
                  color: Colors.white,
                  size: 40,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: Text('speak'.tr()),
          ),
        ],
      ),
    );
  }
}
