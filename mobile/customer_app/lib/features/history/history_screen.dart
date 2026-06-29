import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('히스토리')),
      body: const Center(
        child: Text('최근 본 상품 (구현 예정)', style: TextStyle(color: DoaColors.fgMuted)),
      ),
    );
  }
}
