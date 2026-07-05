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

/// GET /users/me/coupons?status=unused — 적용 가능한 미사용 쿠폰.
final unusedCouponsProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final res = await ref.read(dioProvider).get<List<dynamic>>(
        '/users/me/coupons',
        queryParameters: {'status': 'unused'},
      );
  return (res.data ?? []).cast<Map<String, dynamic>>();
});

/// 쿠폰 라벨 — name 필드 부재로 할인값으로 구성. coupon = UserCoupon.coupon.
String couponLabel(Map<String, dynamic> coupon) {
  final type = coupon['type'] as String?;
  final value = num.tryParse(coupon['discountValue']?.toString() ?? '0') ?? 0;
  if (type == 'PERCENTAGE') {
    final cap = coupon['maxDiscountAmount'];
    final capStr = cap != null ? ' (최대 ${_won.format(num.tryParse(cap.toString()) ?? 0)}원)' : '';
    return '${value.toInt()}% 할인$capStr';
  }
  return '${_won.format(value)}원 할인';
}

/// 백엔드 할인 계산 미러(미리보기용). 실제 할인은 서버가 최종 산정.
num couponDiscount(Map<String, dynamic> coupon, num subtotal) {
  final type = coupon['type'] as String?;
  final value = num.tryParse(coupon['discountValue']?.toString() ?? '0') ?? 0;
  if (type == 'PERCENTAGE') {
    var d = (subtotal * value / 100).floor();
    final cap = coupon['maxDiscountAmount'];
    if (cap != null) {
      final capV = num.tryParse(cap.toString()) ?? d;
      if (d > capV) d = capV.toInt();
    }
    return d;
  }
  return value > subtotal ? subtotal : value;
}

/// 최소 주문 금액 충족 여부.
bool couponApplicable(Map<String, dynamic> coupon, num subtotal) {
  final min = coupon['minOrderAmount'];
  if (min == null) return true;
  return subtotal >= (num.tryParse(min.toString()) ?? 0);
}

/// 체크아웃 — 배송지 선택 + 주문 항목 + 주문 생성(POST /orders) + 결제(POST /payments).
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, required this.items});
  final List<Map<String, dynamic>> items;
  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  String? _addressId;
  Map<String, dynamic>? _selectedCoupon; // UserCoupon 맵
  bool _loading = false;

  num get _subtotal => widget.items.fold<num>(
        0,
        (s, it) => s + (num.tryParse(it['unitPrice'].toString()) ?? 0) * (it['quantity'] as num),
      );

  num get _discount {
    final c = _selectedCoupon?['coupon'];
    if (c is! Map) return 0;
    return couponDiscount(c.cast<String, dynamic>(), _subtotal);
  }

  num get _finalTotal {
    final t = _subtotal - _discount;
    return t < 0 ? 0 : t;
  }

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
        if (_selectedCoupon != null) 'userCouponId': _selectedCoupon!['id'],
      });
      final orderId = orderRes.data!['id'] as String;
      await dio.post<dynamic>('/payments', data: {
        'orderId': orderId,
        'idempotencyKey': const Uuid().v4(),
      });
      if (!mounted) return;
      ref.invalidate(cartProvider);
      ref.invalidate(unusedCouponsProvider);
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
              _section('쿠폰'),
              _couponRow(),
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
              _amountLine('상품 금액', _subtotal),
              if (_discount > 0) _amountLine('쿠폰 할인', -_discount, color: DoaColors.blue),
              const SizedBox(height: 6),
              Row(children: [
                const Text('결제 금액', style: TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                Text('${_won.format(_finalTotal)}원',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: DoaColors.blue)),
              ]),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: (_addressId == null || _loading) ? null : () => _placeOrder(addrs),
                child: Text(_loading ? '처리 중…' : '${_won.format(_finalTotal)}원 결제하기'),
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

  Widget _amountLine(String label, num value, {Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Text(label, style: const TextStyle(color: DoaColors.fgMuted, fontSize: 13)),
          const Spacer(),
          Text('${value < 0 ? '-' : ''}${_won.format(value.abs())}원',
              style: TextStyle(fontSize: 13, color: color)),
        ]),
      );

  Widget _couponRow() {
    final selected = _selectedCoupon;
    final coupon = selected?['coupon'];
    final label = (coupon is Map)
        ? '${couponLabel(coupon.cast<String, dynamic>())} 적용 (-${_won.format(_discount)}원)'
        : '쿠폰 선택';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: InkWell(
        onTap: _pickCoupon,
        borderRadius: BorderRadius.circular(DoaRadius.control),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            border: Border.all(color: selected != null ? DoaColors.blue : DoaColors.border),
            borderRadius: BorderRadius.circular(DoaRadius.control),
          ),
          child: Row(children: [
            Icon(Icons.confirmation_num_outlined,
                size: 20, color: selected != null ? DoaColors.blue : DoaColors.fgMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: TextStyle(
                    fontSize: 14,
                    color: selected != null ? DoaColors.blue : DoaColors.fg,
                    fontWeight: selected != null ? FontWeight.w600 : FontWeight.w400,
                  )),
            ),
            const Icon(Icons.chevron_right, size: 20, color: DoaColors.fgSubtle),
          ]),
        ),
      ),
    );
  }

  Future<void> _pickCoupon() async {
    final coupons = await ref.read(unusedCouponsProvider.future);
    if (!mounted) return;
    final result = await showModalBottomSheet<Map<String, dynamic>?>(
      context: context,
      backgroundColor: DoaColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _CouponSheet(
        coupons: coupons,
        subtotal: _subtotal,
        selectedId: _selectedCoupon?['id'] as String?,
      ),
    );
    // result: UserCoupon 맵=선택 / {'__none__': true}=미적용 / null=취소(변경 없음)
    if (result == null) return;
    setState(() => _selectedCoupon = result['__none__'] == true ? null : result);
  }

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

/// 쿠폰 선택 바텀시트 — 적용 가능 쿠폰만 선택 가능(최소주문 미달은 비활성).
class _CouponSheet extends StatelessWidget {
  const _CouponSheet({required this.coupons, required this.subtotal, required this.selectedId});
  final List<Map<String, dynamic>> coupons;
  final num subtotal;
  final String? selectedId;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 18, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('쿠폰 선택', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.block, color: DoaColors.fgSubtle),
            title: const Text('쿠폰 미적용'),
            trailing: selectedId == null ? const Icon(Icons.check, color: DoaColors.blue) : null,
            onTap: () => Navigator.pop(context, {'__none__': true}),
          ),
          const Divider(height: 1),
          if (coupons.isEmpty)
            const Padding(
              padding: EdgeInsets.all(28),
              child: Text('보유한 쿠폰이 없습니다.', style: TextStyle(color: DoaColors.fgMuted)),
            )
          else
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: coupons.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final uc = coupons[i];
                  final c = (uc['coupon'] as Map?)?.cast<String, dynamic>() ?? {};
                  final applicable = couponApplicable(c, subtotal);
                  final discount = couponDiscount(c, subtotal);
                  final min = c['minOrderAmount'];
                  final selected = uc['id'] == selectedId;
                  return ListTile(
                    enabled: applicable,
                    leading: Icon(Icons.confirmation_num_outlined,
                        color: applicable ? DoaColors.blue : DoaColors.fgSubtle),
                    title: Text(couponLabel(c),
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: applicable ? DoaColors.fg : DoaColors.fgSubtle,
                        )),
                    subtitle: Text(
                      applicable
                          ? '-${_won.format(discount)}원 적용'
                          : '최소 주문 ${_won.format(num.tryParse(min?.toString() ?? '0') ?? 0)}원',
                      style: TextStyle(
                          fontSize: 12,
                          color: applicable ? DoaColors.blue : DoaColors.danger),
                    ),
                    trailing: selected ? const Icon(Icons.check, color: DoaColors.blue) : null,
                    onTap: applicable ? () => Navigator.pop(context, uc) : null,
                  );
                },
              ),
            ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
