import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class CategoryScreen extends StatelessWidget {
  const CategoryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('카테고리')),
      body: const Center(
        child: Text('카테고리 (구현 예정)', style: TextStyle(color: DoaColors.fgMuted)),
      ),
    );
  }
}
