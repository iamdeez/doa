import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/providers.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/app_shell.dart';
import 'theme/app_theme.dart';

class DoaApp extends ConsumerWidget {
  const DoaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return MaterialApp(
      title: 'DOA',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: switch (auth) {
        AuthStatus.unknown => const _Splash(),
        AuthStatus.authenticated => const AppShell(),
        AuthStatus.unauthenticated => const LoginScreen(),
      },
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: DoaColors.surface,
      body: Center(
        child: Text('DOA',
            style: TextStyle(fontSize: 40, fontWeight: FontWeight.w900, color: DoaColors.blue)),
      ),
    );
  }
}
