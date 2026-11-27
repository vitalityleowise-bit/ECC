import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../content/persona.dart';
import '../../content/persona_repository.dart';
import '../conversation/conversation_screen.dart';

/// Home screen: pick a target language, a level, and a conversation style.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  String _language = 'en';
  String _levelId = 'beginner';

  @override
  Widget build(BuildContext context) {
    final catalogAsync = ref.watch(personaCatalogProvider);
    final uiLang = context.locale.languageCode;

    return Scaffold(
      appBar: AppBar(title: Text('app_name'.tr())),
      body: catalogAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Error: $error')),
        data: (catalog) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('choose_language'.tr(),
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _LanguagePicker(
              languages: catalog.targetLanguages,
              selected: _language,
              onChanged: (value) => setState(() => _language = value),
            ),
            const SizedBox(height: 24),
            Text('choose_level'.tr(),
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            _LevelPicker(
              levels: catalog.levels,
              uiLang: uiLang,
              selected: _levelId,
              onChanged: (value) => setState(() => _levelId = value),
            ),
            const SizedBox(height: 24),
            Text('choose_style'.tr(),
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            ...catalog.styles.map(
              (style) => _StyleCard(
                style: style,
                uiLang: uiLang,
                onTap: () => _startConversation(style),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _startConversation(ConversationStyle style) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ConversationScreen(
          style: style,
          targetLanguage: _language,
          levelId: _levelId,
        ),
      ),
    );
  }
}

class _LanguagePicker extends StatelessWidget {
  const _LanguagePicker({
    required this.languages,
    required this.selected,
    required this.onChanged,
  });

  final List<String> languages;
  final String selected;
  final ValueChanged<String> onChanged;

  static const Map<String, String> _names = {
    'en': 'English',
    'es': 'Español',
    'fr': 'Français',
  };

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: languages
          .map((code) => ChoiceChip(
                label: Text(_names[code] ?? code),
                selected: selected == code,
                onSelected: (_) => onChanged(code),
              ))
          .toList(),
    );
  }
}

class _LevelPicker extends StatelessWidget {
  const _LevelPicker({
    required this.levels,
    required this.uiLang,
    required this.selected,
    required this.onChanged,
  });

  final List<Level> levels;
  final String uiLang;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      children: levels
          .map((level) => ChoiceChip(
                label: Text(level.label.resolve(uiLang)),
                selected: selected == level.id,
                onSelected: (_) => onChanged(level.id),
              ))
          .toList(),
    );
  }
}

class _StyleCard extends StatelessWidget {
  const _StyleCard({
    required this.style,
    required this.uiLang,
    required this.onTap,
  });

  final ConversationStyle style;
  final String uiLang;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const Icon(Icons.forum_outlined),
        title: Text(style.label.resolve(uiLang)),
        subtitle: Text(style.description.resolve(uiLang)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
