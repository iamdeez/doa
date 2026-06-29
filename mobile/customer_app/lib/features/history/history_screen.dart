import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/providers.dart';
import '../../theme/app_theme.dart';
import '../home/home_screen.dart';
import '../product/product_detail_screen.dart';

final _won = NumberFormat('#,###', 'ko_KR');

/// GET /users/me/recent-views → productId 목록(viewedAt desc). P-001 경계로
/// 상품 상세 미포함 → 각 productId 를 GET /products/:id 로 보강(N+1, 최대 30건).
final recentViewsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get<List<dynamic>>('/users/me/recent-views');
  final views = (res.data ?? []).cast<Map<String, dynamic>>();
  final products = await Future.wait(views.map((v) async {
    try {
      final p = await dio.get<Map<String, dynamic>>('/products/${v['productId']}',
          options: Options(extra: {'anonymous': true}));
      return p.data;
    } on DioException {
      return null;
    }
  }));
  return [for (final p in products) if (p != null) p];
});

/// 히스토리 — 최근 본 상품 + "먼저 둘러보세요" 추천(목업 기준).
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recent = ref.watch(recentViewsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('히스토리'), automaticallyImplyLeading: false),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(recentViewsProvider.future),
        child: ListView(
          children: [
            recent.when(
              loading: () => const Padding(
                  padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
              error: (e, _) => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('최근 본 상품을 불러오지 못했습니다.', style: TextStyle(color: DoaColors.fgMuted))),
              data: (items) => items.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: Text('최근 본 상품이 없습니다.', style: TextStyle(color: DoaColors.fgMuted))))
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                          child: Text('총 ${items.length}개',
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        _grid(items),
                      ],
                    ),
            ),
            const Divider(height: 24, thickness: 8, color: DoaColors.canvas),
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Text('먼저 둘러보세요', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ),
            const _Recommendations(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _grid(List<Map<String, dynamic>> items) => GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2, childAspectRatio: 0.62, crossAxisSpacing: 12, mainAxisSpacing: 16),
        itemCount: items.length,
        itemBuilder: (_, i) => _HistoryCard(product: items[i]),
      );
}

/// "먼저 둘러보세요" — 홈 최신 상품 재사용(homeProductsProvider).
class _Recommendations extends ConsumerWidget {
  const _Recommendations();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(homeProductsProvider);
    return products.maybeWhen(
      data: (items) => GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2, childAspectRatio: 0.62, crossAxisSpacing: 12, mainAxisSpacing: 16),
        itemCount: items.length,
        itemBuilder: (_, i) => _HistoryCard(product: items[i]),
      ),
      orElse: () => const Padding(
          padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.product});
  final Map<String, dynamic> product;
  @override
  Widget build(BuildContext context) {
    final images = (product['images'] as List?) ?? [];
    final imageUrl = images.isNotEmpty ? images.first['url'] as String? : null;
    final price = num.tryParse(product['price']?.toString() ?? '0') ?? 0;
    return InkWell(
      onTap: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => ProductDetailScreen(productId: product['id'] as String))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(DoaRadius.card),
              child: imageUrl != null
                  ? CachedNetworkImage(imageUrl: imageUrl, fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => Container(color: DoaColors.muted))
                  : Container(color: DoaColors.muted),
            ),
          ),
          const SizedBox(height: 8),
          Text(product['title'] as String? ?? '', maxLines: 2, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, height: 1.3)),
          const SizedBox(height: 4),
          Text('${_won.format(price)}원', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
