import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import '../../core/providers.dart';
import '../../theme/app_theme.dart';
import '../cart/cart_screen.dart';

final _won = NumberFormat('#,###', 'ko_KR');

final addressesProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.read(dioProvider).get<List<dynamic>>('/users/me/addresses');
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

/// 체크아웃 — 배송지 선택 + 주문 항목 + 주문 생성(POST /orders) + 결제(POST /payments).
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, required this.items});
  final List<Map<String, dynamic>> items;
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  String? _addressId;
  bool _loading = false;

  num get _total => widget.items.fold<num>(
        0,
        (s, it) => s + (num.tryParse(it['unitPrice'].toString()) ?? 0) * (it['quantity'] as num),
      );

  Future<void> _placeOrder(List<Map<String, dynamic>> addresses) async {
    final address = addresses.where((a) => a['id'] == _addressId).firstOrNull;
    if (address == null) return;
    setState(() => _loading = true);
    final dio = ref.read(dioProvider);
    try {
      final orderRes = await dio.post<Map<String, dynamic>>('/orders', data: {
        'items': [
          for (final it in widget.items) {'variantId': it['variantId'], 'quantity': it['quantity']},
        ],
        'shippingAddress': {
          'recipientName': address['recipientName'],
          'phone': address['phone'],
          'zipCode': address['zipCode'],
          'address1': address['address1'],
          'address2': address['address2'],
        },
      });
      final orderId = orderRes.data!['id'] as String;
      await dio.post<dynamic>('/payments', data: {
        'orderId': orderId,
        'idempotencyKey': const Uuid().v4(),
      });
      if (!mounted) return;
      ref.invalidate(cartProvider);
      showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('주문 완료'),
          content: const Text('결제가 완료되었습니다.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                Navigator.popUntil(context, (r) => r.isFirst);
              },
              child: const Text('확인'),
            ),
          ],
        ),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map ? e.response!.data['message'] : null;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg is String ? msg : '주문에 실패했습니다.')),
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final addresses = ref.watch(addressesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('주문/결제')),
      body: addresses.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('배송지를 불러오지 못했습니다.\n$e')),
        data: (addrs) {
          _addressId ??= (addrs.where((a) => a['isDefault'] == true).firstOrNull ??
              addrs.firstOrNull)?['id'] as String?;
          return ListView(
            children: [
              _section('배송지'),
              if (addrs.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('등록된 배송지가 없습니다. 내정보에서 배송지를 추가하세요.',
                      style: TextStyle(color: DoaColors.fgMuted)),
                )
              else
                for (final a in addrs) _addressTile(a),
              _section('주문 상품'),
              for (final it in widget.items) _itemRow(it),
            ],
          );
        },
      ),
      bottomNavigationBar: addresses.maybeWhen(
        data: (addrs) => SafeArea(
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: DoaColors.surface,
              border: Border(top: BorderSide(color: DoaColors.border)),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Row(children: [
                const Text('결제 금액', style: TextStyle(fontWeight: FontWeight.w700)),
                const Spacer(),
                Text('${_won.format(_total)}원',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: DoaColors.blue)),
              ]),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: (_addressId == null || _loading) ? null : () => _placeOrder(addrs),
                child: Text(_loading ? '처리 중…' : '${_won.format(_total)}원 결제하기'),
              ),
            ]),
          ),
        ),
        orElse: () => null,
      ),
    );
  }

  Widget _section(String t) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
        child: Text(t, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
      );

  Widget _addressTile(Map<String, dynamic> a) {
    final selected = a['id'] == _addressId;
    return InkWell(
      onTap: () => setState(() => _addressId = a['id'] as String),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: DoaColors.surface,
          border: Border.all(color: selected ? DoaColors.blue : DoaColors.border),
          borderRadius: BorderRadius.circular(DoaRadius.card),
        ),
        child: Row(children: [
          Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? DoaColors.blue : DoaColors.fgSubtle, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(a['recipientName'] as String? ?? '', style: const TextStyle(fontWeight: FontWeight.w700)),
                if (a['isDefault'] == true) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: DoaColors.blueSoft, borderRadius: BorderRadius.circular(4)),
                    child: const Text('기본', style: TextStyle(fontSize: 11, color: DoaColors.blue)),
                  ),
                ],
              ]),
              const SizedBox(height: 4),
              Text('${a['address1'] ?? ''} ${a['address2'] ?? ''}',
                  style: const TextStyle(color: DoaColors.fgMuted, fontSize: 13)),
              Text(a['phone'] as String? ?? '', style: const TextStyle(color: DoaColors.fgSubtle, fontSize: 12)),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _itemRow(Map<String, dynamic> it) {
    final unit = num.tryParse(it['unitPrice'].toString()) ?? 0;
    final qty = it['quantity'] as num;
    return Container(
      color: DoaColors.surface,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(it['productTitle'] as String? ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
            Text('${it['optionValue'] ?? ''} · $qty' '개',
                style: const TextStyle(color: DoaColors.fgMuted, fontSize: 13)),
          ]),
        ),
        Text('${_won.format(unit * qty)}원', style: const TextStyle(fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
