import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/app_theme.dart';
import 'features/home/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  runApp(
    EasyLocalization(
      supportedLocales: const [Locale('ht'), Locale('fr'), Locale('en')],
      path: 'assets/translations',
      fallbackLocale: const Locale('en'),
      child: const ProviderScope(child: VitalityCoursApp()),
    ),
  );
}

class VitalityCoursApp extends StatelessWidget {
  const VitalityCoursApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VITALITY COURS',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: const HomeScreen(),
    );
  }
}
