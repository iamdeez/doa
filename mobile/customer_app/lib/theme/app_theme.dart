import 'package:flutter/material.dart';

/// DOA 고객 앱 디자인 시스템 — DOA_리뉴얼_1118 목업 기준.
/// 비비드 블루 브랜드 + 흰 배경 + 둥근 카드 + 한국 커머스 UX.
class DoaColors {
  DoaColors._();

  /// DOA 브랜드 블루 (로고·버튼·가격·활성 상태).
  static const blue = Color(0xFF1F62E6);
  static const blueDark = Color(0xFF1A52C4);
  static const blueSoft = Color(0xFFEAF1FE);

  static const canvas = Color(0xFFF5F6F8);
  static const surface = Color(0xFFFFFFFF);
  static const muted = Color(0xFFF2F3F5);

  static const fg = Color(0xFF1A1C1F);
  static const fgMuted = Color(0xFF6B7280);
  static const fgSubtle = Color(0xFF9CA3AF);

  static const border = Color(0xFFE5E7EB);
  static const danger = Color(0xFFE5484D);
  static const star = Color(0xFFFFB400);
}

class DoaRadius {
  DoaRadius._();
  static const control = 10.0;
  static const card = 14.0;
  static const pill = 999.0;
}

class AppTheme {
  static ThemeData light() {
    const blue = DoaColors.blue;
    final base = ThemeData(
      useMaterial3: true,
      fontFamily: 'Pretendard',
      scaffoldBackgroundColor: DoaColors.canvas,
      colorScheme: const ColorScheme.light(
        primary: blue,
        onPrimary: Colors.white,
        secondary: blue,
        surface: DoaColors.surface,
        onSurface: DoaColors.fg,
        error: DoaColors.danger,
      ),
    );

    return base.copyWith(
      appBarTheme: const AppBarTheme(
        backgroundColor: DoaColors.surface,
        foregroundColor: DoaColors.fg,
        elevation: 0,
        scrolledUnderElevation: 0.5,
        centerTitle: true,
        titleTextStyle: TextStyle(
          color: DoaColors.fg,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      textTheme: base.textTheme
          .apply(bodyColor: DoaColors.fg, displayColor: DoaColors.fg)
          .copyWith(
            titleLarge: const TextStyle(fontWeight: FontWeight.w700),
            titleMedium: const TextStyle(fontWeight: FontWeight.w600),
          ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: blue,
          foregroundColor: Colors.white,
          elevation: 0,
          minimumSize: const Size.fromHeight(52),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DoaRadius.control),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: blue,
          minimumSize: const Size.fromHeight(52),
          side: const BorderSide(color: blue),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(DoaRadius.control),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: DoaColors.surface,
        hintStyle: const TextStyle(color: DoaColors.fgSubtle),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DoaRadius.control),
          borderSide: const BorderSide(color: DoaColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DoaRadius.control),
          borderSide: const BorderSide(color: blue, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(DoaRadius.control),
          borderSide: const BorderSide(color: DoaColors.danger),
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: DoaColors.border,
        thickness: 1,
        space: 1,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: DoaColors.surface,
        selectedItemColor: blue,
        unselectedItemColor: DoaColors.fgSubtle,
        selectedLabelStyle: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
        unselectedLabelStyle: TextStyle(fontSize: 11),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
    );
  }
}
