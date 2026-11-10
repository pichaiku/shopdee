import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_config.dart';
import 'product_detail.dart';

const _brand = Color(0xFF2F80ED);
const _brandDark = Color(0xFF1C5FBF);
const _recommendLimit = 10;

final _baht = NumberFormat('#,##0.00');

String _formatBaht(dynamic value) =>
    '฿${_baht.format(double.tryParse(value.toString()) ?? 0)}';

/// Section on top of the home page.
/// - Logged-in customers: up to 10 items from the ML service (`ML_URL/recommend/{custID}`)
/// - Fewer than 10, or not logged in: filled with best sellers (most ordered first)
class RecommendationResult {
  final List<Map<String, dynamic>> items;
  final int recommendedCount;
  const RecommendationResult(this.items, this.recommendedCount);
}

Future<dynamic> _getJson(String url) async {
  try {
    final res = await http
        .get(Uri.parse(url))
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return null;
    // pandas may emit NaN for NULL columns, which is not valid JSON
    return jsonDecode(
      utf8.decode(res.bodyBytes).replaceAll(RegExp(r'\bNaN\b'), 'null'),
    );
  } catch (_) {
    return null;
  }
}

Future<RecommendationResult> fetchRecommendations(int? custID) async {
  final results = await Future.wait([
    custID != null
        ? _getJson('${ApiConfig.mlUrl}/recommend/$custID')
        : Future.value(null),
    _getJson('${ApiConfig.productList}/popular?limit=${_recommendLimit * 2}'),
  ]);
  final ml = results[0];
  final popular =
      (results[1] is List ? results[1] as List : const [])
          .whereType<Map>()
          .map((p) => Map<String, dynamic>.from(p))
          .toList();
  final popularById = {for (final p in popular) _id(p): p};

  final items = <Map<String, dynamic>>[];
  final seen = <int>{};

  if (ml is List) {
    for (final raw in ml.whereType<Map>()) {
      final id = _id(raw);
      if (id == 0 || !seen.add(id)) continue;
      items.add({
        ...Map<String, dynamic>.from(raw),
        ...?popularById[id],
        'source': 'recommended',
      });
      if (items.length >= _recommendLimit) break;
    }
  }
  final recommendedCount = items.length;

  for (final p in popular) {
    if (items.length >= _recommendLimit) break;
    if (!seen.add(_id(p))) continue;
    items.add({...p, 'source': 'popular'});
  }
  return RecommendationResult(items, recommendedCount);
}

int _id(Map p) => int.tryParse('${p['productID']}') ?? 0;
int _stock(Map p) => int.tryParse('${p['quantity']}') ?? 0;
double _price(Map p) => double.tryParse('${p['price']}') ?? 0;

enum _Sort { recommended, priceLow, priceHigh, newest }

const _sortLabels = {
  _Sort.recommended: 'แนะนำ',
  _Sort.priceLow: 'ราคา: ต่ำ → สูง',
  _Sort.priceHigh: 'ราคา: สูง → ต่ำ',
  _Sort.newest: 'สินค้าใหม่ล่าสุด',
};

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final TextEditingController searchController = TextEditingController();
  final ScrollController recScroll = ScrollController();

  void _scrollRecommendations(int direction) {
    if (!recScroll.hasClients) return;
    final pos = recScroll.position;
    final target = (pos.pixels + direction * pos.viewportDimension * 0.8).clamp(
      0.0,
      pos.maxScrollExtent,
    );
    recScroll.animateTo(
      target,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  List<Map<String, dynamic>> products = [];
  RecommendationResult? recommendations;
  bool loading = true;
  bool recLoading = true;
  String? error;
  bool loggedIn = false;

  String query = '';
  String? category;
  _Sort sort = _Sort.recommended;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    searchController.dispose();
    recScroll.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    final custID = prefs.getInt('custID');
    final token = prefs.getString('token');
    final hasUser = custID != null && token != null;
    if (mounted) setState(() => loggedIn = hasUser);
    await Future.wait([
      _fetchProducts(),
      _fetchRecommendations(hasUser ? custID : null),
    ]);
  }

  Future<void> _fetchProducts() async {
    setState(() {
      loading = products.isEmpty;
      error = null;
    });
    final data = await _getJson(ApiConfig.productList);
    if (!mounted) return;
    setState(() {
      loading = false;
      if (data is List) {
        products =
            data
                .whereType<Map>()
                .map((p) => Map<String, dynamic>.from(p))
                .toList();
      } else {
        error = 'ไม่สามารถโหลดรายการสินค้าได้';
      }
    });
  }

  Future<void> _fetchRecommendations(int? custID) async {
    setState(() => recLoading = recommendations == null);
    final result = await fetchRecommendations(custID);
    if (!mounted) return;
    setState(() {
      recommendations = result;
      recLoading = false;
    });
  }

  List<String> get _categories {
    final set = <String>{};
    for (final p in products) {
      final t = p['typeName'];
      if (t != null && '$t'.isNotEmpty) set.add('$t');
    }
    return set.toList()..sort();
  }

  List<Map<String, dynamic>> get _visibleProducts {
    final q = query.trim().toLowerCase();
    final list =
        products.where((p) {
          if (category != null && p['typeName'] != category) return false;
          if (q.isEmpty) return true;
          return '${p['productName']} ${p['productDetail'] ?? ''} ${p['typeName'] ?? ''}'
              .toLowerCase()
              .contains(q);
        }).toList();
    switch (sort) {
      case _Sort.priceLow:
        list.sort((a, b) => _price(a).compareTo(_price(b)));
      case _Sort.priceHigh:
        list.sort((a, b) => _price(b).compareTo(_price(a)));
      case _Sort.newest:
        list.sort((a, b) => _id(b).compareTo(_id(a)));
      case _Sort.recommended:
        break;
    }
    return list;
  }

  void _openProduct(Map<String, dynamic> product) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => ProductDetailPage(product: product)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final searching = query.trim().isNotEmpty;
    final visible = _visibleProducts;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      body: RefreshIndicator(
        color: _brand,
        onRefresh: _loadAll,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            _buildAppBar(),
            if (!searching) SliverToBoxAdapter(child: _buildBanner()),
            if (!searching) SliverToBoxAdapter(child: _buildRecommendations()),
            SliverToBoxAdapter(child: _buildListHeader(visible.length)),
            SliverToBoxAdapter(child: _buildCategoryChips()),
            ..._buildProductGrid(visible),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return SliverAppBar(
      pinned: true,
      automaticallyImplyLeading: false,
      backgroundColor: _brand,
      foregroundColor: Colors.white,
      elevation: 0,
      title: const Text(
        'Shopdee',
        style: TextStyle(fontWeight: FontWeight.bold),
      ),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(64),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          child: TextField(
            controller: searchController,
            onChanged: (v) => setState(() => query = v),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'ค้นหาสินค้า...',
              filled: true,
              fillColor: Colors.white,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(24),
                borderSide: BorderSide.none,
              ),
              prefixIcon: const Icon(Icons.search, color: Colors.black54),
              suffixIcon:
                  query.isEmpty
                      ? null
                      : IconButton(
                        tooltip: 'ล้างคำค้นหา',
                        icon: const Icon(Icons.close, color: Colors.black54),
                        onPressed: () {
                          searchController.clear();
                          setState(() => query = '');
                        },
                      ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBanner() {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(colors: [_brand, _brandDark]),
      ),
      child: const Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ช้อปง่าย ส่งฟรีทุกออเดอร์',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'จ่ายได้ทั้งบัตรเครดิต และโอนแนบสลิป',
                  style: TextStyle(color: Color(0xDDFFFFFF), fontSize: 13),
                ),
              ],
            ),
          ),
          Icon(Icons.local_shipping_outlined, color: Colors.white, size: 40),
        ],
      ),
    );
  }

  Widget _buildRecommendations() {
    final rec = recommendations;
    final personalised = (rec?.recommendedCount ?? 0) > 0;
    final title =
        personalised ? 'สินค้าแนะนำสำหรับคุณ' : 'สินค้าขายดี 10 อันดับ';
    final subtitle =
        personalised
            ? 'คัดจากประวัติการซื้อของคุณ'
            : loggedIn
            ? 'สั่งซื้อเพิ่มเพื่อรับคำแนะนำเฉพาะคุณ'
            : 'เข้าสู่ระบบเพื่อรับคำแนะนำเฉพาะคุณ';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
          child: Row(
            children: [
              Icon(
                personalised ? Icons.auto_awesome : Icons.local_fire_department,
                color: personalised ? _brand : Colors.deepOrange,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      key: const Key('recommended-title'),
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              // Arrow buttons for mouse users (Flutter web / desktop); phones just swipe
              if (kIsWeb && (rec?.items.length ?? 0) > 1) ...[
                _ScrollArrow(
                  icon: Icons.chevron_left,
                  tooltip: 'ก่อนหน้า',
                  onPressed: () => _scrollRecommendations(-1),
                ),
                const SizedBox(width: 6),
                _ScrollArrow(
                  icon: Icons.chevron_right,
                  tooltip: 'ถัดไป',
                  onPressed: () => _scrollRecommendations(1),
                ),
              ],
            ],
          ),
        ),
        SizedBox(
          height: 238,
          child:
              recLoading
                  ? const Center(child: CircularProgressIndicator())
                  : (rec == null || rec.items.isEmpty)
                  ? const Center(
                    child: Text(
                      'ยังไม่มีสินค้าแนะนำ',
                      style: TextStyle(color: Colors.black54),
                    ),
                  )
                  : Scrollbar(
                    controller: recScroll,
                    thumbVisibility: kIsWeb,
                    child: ListView.separated(
                      controller: recScroll,
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      itemCount: rec.items.length,
                      separatorBuilder: (_, _) => const SizedBox(width: 10),
                      itemBuilder: (_, i) {
                        final p = rec.items[i];
                        final isRec = p['source'] == 'recommended';
                        return SizedBox(
                          width: 150,
                          child: _ProductCard(
                            product: p,
                            badge:
                                isRec
                                    ? 'แนะนำ'
                                    : 'ขายดี #${i - rec.recommendedCount + 1}',
                            badgeColor: isRec ? _brand : Colors.deepOrange,
                            onTap: () => _openProduct(p),
                          ),
                        );
                      },
                    ),
                  ),
        ),
      ],
    );
  }

  Widget _buildListHeader(int count) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 4, 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              query.trim().isEmpty
                  ? 'สินค้าทั้งหมด'
                  : 'ผลการค้นหา "${query.trim()}"',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Text(
            '$count รายการ',
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
          PopupMenuButton<_Sort>(
            tooltip: 'เรียงลำดับ',
            icon: const Icon(Icons.sort),
            initialValue: sort,
            onSelected: (v) => setState(() => sort = v),
            itemBuilder:
                (_) => [
                  for (final e in _sortLabels.entries)
                    PopupMenuItem(value: e.key, child: Text(e.value)),
                ],
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChips() {
    final cats = _categories;
    if (cats.isEmpty) return const SizedBox.shrink();
    Widget chip(String label, String? value) => Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: category == value,
        selectedColor: _brand,
        labelStyle: TextStyle(
          color: category == value ? Colors.white : Colors.black87,
        ),
        showCheckmark: false,
        onSelected: (_) => setState(() => category = value),
      ),
    );
    return SizedBox(
      height: 48,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        children: [chip('ทั้งหมด', null), for (final c in cats) chip(c, c)],
      ),
    );
  }

  List<Widget> _buildProductGrid(List<Map<String, dynamic>> visible) {
    if (loading) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          ),
        ),
      ];
    }
    if (error != null) {
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              children: [
                Text(error!, style: const TextStyle(color: Colors.redAccent)),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: _loadAll,
                  child: const Text('ลองใหม่'),
                ),
              ],
            ),
          ),
        ),
      ];
    }
    if (visible.isEmpty) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.all(40),
            child: Column(
              children: [
                Icon(Icons.search_off, size: 48, color: Colors.black26),
                SizedBox(height: 8),
                Text(
                  'ไม่พบสินค้าที่ตรงกับเงื่อนไข',
                  style: TextStyle(color: Colors.black54),
                ),
              ],
            ),
          ),
        ),
      ];
    }
    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        sliver: SliverGrid(
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 220,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.66,
          ),
          delegate: SliverChildBuilderDelegate(
            (_, i) => _ProductCard(
              product: visible[i],
              onTap: () => _openProduct(visible[i]),
            ),
            childCount: visible.length,
          ),
        ),
      ),
    ];
  }
}

class _ScrollArrow extends StatelessWidget {
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  const _ScrollArrow({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const CircleBorder(side: BorderSide(color: Color(0xFFDDE2EA))),
      child: IconButton(
        tooltip: tooltip,
        icon: Icon(icon),
        iconSize: 20,
        visualDensity: VisualDensity.compact,
        onPressed: onPressed,
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback onTap;
  final String? badge;
  final Color badgeColor;

  const _ProductCard({
    required this.product,
    required this.onTap,
    this.badge,
    this.badgeColor = _brand,
  });

  @override
  Widget build(BuildContext context) {
    final outOfStock = _stock(product) <= 0;
    final typeName = product['typeName'];

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      elevation: 1,
      shadowColor: const Color(0x33000000),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    '${ApiConfig.productImage}${product['imageFile']}',
                    fit: BoxFit.cover,
                    errorBuilder:
                        (_, _, _) => const ColoredBox(
                          color: Color(0xFFEFF1F5),
                          child: Icon(
                            Icons.image_not_supported_outlined,
                            color: Colors.black26,
                          ),
                        ),
                  ),
                  if (badge != null)
                    Positioned(
                      left: 6,
                      top: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: badgeColor,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          badge!,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  if (outOfStock)
                    const ColoredBox(
                      color: Color(0x88FFFFFF),
                      child: Center(
                        child: Chip(
                          label: Text(
                            'สินค้าหมด',
                            style: TextStyle(color: Colors.white, fontSize: 12),
                          ),
                          backgroundColor: Colors.black87,
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (typeName != null)
                    Text(
                      '$typeName',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Colors.black45,
                      ),
                    ),
                  Text(
                    '${product['productName']}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatBaht(product['price']),
                    style: const TextStyle(
                      color: _brand,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
