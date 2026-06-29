import 'package:flutter/material.dart';

import '../category/category_screen.dart';
import '../history/history_screen.dart';
import '../home/home_screen.dart';
import '../mypage/mypage_screen.dart';

/// 하단 4탭 셸 — 카테고리 · 홈 · 히스토리 · 내정보 (목업 기준).
class AppShell extends StatefulWidget {
  const AppShell({super.key});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 1; // 홈 기본
  static const _screens = [
    CategoryScreen(),
    HomeScreen(),
    HistoryScreen(),
    MyPageScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.menu), label: '카테고리'),
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: '홈'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: '히스토리'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: '내정보'),
        ],
      ),
    );
  }
}
