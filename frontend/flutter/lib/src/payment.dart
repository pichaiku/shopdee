import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:omise_flutter/omise_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
import 'api_config.dart';
import 'slip_upload.dart';

/// หน้าชำระเงิน: เลือกจ่ายด้วยบัตรเครดิต (Omise) หรือโอนเงินแล้วอัปโหลดสลิป
///
/// Web vs Mobile:
/// - Mobile ใช้หน้าบัตรสำเร็จรูปของ omise_flutter
/// - Web ใช้ฟอร์มของเราเอง แล้วสร้าง token ผ่าน https://vault.omise.co/tokens
///   (ห้ามสร้าง OmisePayment บนเว็บ: constructor เรียก ScreenProtector ซึ่งเป็น native plugin
///    ไม่มีบนเว็บ -> MissingPluginException ทำให้หน้าเว็บพังเมื่อรันบน Chrome)
class PaymentPage extends StatefulWidget {
  final int orderID;
  final double amount;

  const PaymentPage({super.key, required this.orderID, required this.amount});

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

enum _Method { card, slip }

class _PaymentPageState extends State<PaymentPage> {
  static const _primary = Color(0xFF2F80ED);

  final _formKey = GlobalKey<FormState>();
  final _cardNumberController = TextEditingController();
  final _cardholderNameController = TextEditingController();
  final _expiryController = TextEditingController(); // MM/YY
  final _securityCodeController = TextEditingController();

  _Method _method = _Method.card;
  bool _isProcessing = false;
  String? _errorMessage;

  OmisePayment? _omisePayment; // mobile only

  String get _publicKey => dotenv.env['omise_public_key'] ?? '';

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _omisePayment = OmisePayment(publicKey: _publicKey, enableDebug: kDebugMode, locale: OmiseLocale.en);
    }
  }

  @override
  void dispose() {
    _cardNumberController.dispose();
    _cardholderNameController.dispose();
    _expiryController.dispose();
    _securityCodeController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Card payment
  // ---------------------------------------------------------------------------

  Future<({int custID, String token})?> _session() async {
    final prefs = await SharedPreferences.getInstance();
    final custID = prefs.getInt('custID');
    final token = prefs.getString('token');
    if (custID == null || token == null) {
      _setError('กรุณาเข้าสู่ระบบก่อนชำระเงิน');
      return null;
    }
    return (custID: custID, token: token);
  }

  Future<void> _payWithCard() async {
    setState(() => _errorMessage = null);
    if (_publicKey.isEmpty) {
      _setError('ไม่พบ omise_public_key ในไฟล์ .env');
      return;
    }
    if (kIsWeb && !(_formKey.currentState?.validate() ?? false)) return;

    final session = await _session();
    if (session == null) return;

    setState(() => _isProcessing = true);
    try {
      final paymentToken = kIsWeb ? await _createTokenWeb() : await _createTokenMobile();
      if (paymentToken == null) return;
      await _chargeOnBackend(session.custID, session.token, paymentToken);
    } catch (e) {
      _setError('เกิดข้อผิดพลาด: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<String?> _createTokenMobile() async {
    final result = await Navigator.push<OmisePaymentResult>(
      context,
      MaterialPageRoute(builder: (_) => _omisePayment!.buildCardPage()),
    );
    final token = result?.token?.id ?? result?.source?.id;
    if (token == null || token.isEmpty) {
      _setError('ยกเลิกการชำระเงิน หรือไม่พบโทเคนของบัตร');
      return null;
    }
    return token;
  }

  Future<String?> _createTokenWeb() async {
    final expiry = _expiryController.text.split('/');
    final month = expiry[0].trim();
    var year = expiry.length > 1 ? expiry[1].trim() : '';
    if (year.length == 2) year = '20$year';

    final auth = base64Encode(utf8.encode('$_publicKey:'));
    final response = await http
        .post(
          Uri.parse('https://vault.omise.co/tokens'),
          headers: {'Authorization': 'Basic $auth'},
          body: {
            'card[number]': _cardNumberController.text.replaceAll(' ', ''),
            'card[name]': _cardholderNameController.text.trim(),
            'card[expiration_month]': month,
            'card[expiration_year]': year,
            'card[security_code]': _securityCodeController.text.trim(),
          },
        )
        .timeout(const Duration(seconds: 20));

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['object'] == 'token' && data['id'] != null) {
      return data['id'] as String;
    }
    _setError(_translateOmiseError(data['message']?.toString()));
    return null;
  }

  String _translateOmiseError(String? message) {
    if (message == null) return 'ไม่สามารถตรวจสอบข้อมูลบัตรได้';
    final m = message.toLowerCase();
    if (m.contains('number')) return 'หมายเลขบัตรไม่ถูกต้อง';
    if (m.contains('expir')) return 'วันหมดอายุบัตรไม่ถูกต้อง';
    if (m.contains('security code') || m.contains('cvv')) return 'รหัส CVV ไม่ถูกต้อง';
    return message;
  }

  Future<void> _chargeOnBackend(int custID, String token, String paymentToken) async {
    final response = await http
        .post(
          Uri.parse(ApiConfig.confirmpayment),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: jsonEncode({
            'custID': custID,
            'orderID': widget.orderID,
            'amount': (widget.amount * 100).round(), // server re-calculates; kept for compatibility
            'paymentToken': paymentToken,
          }),
        )
        .timeout(const Duration(seconds: 30));

    final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode == 200 && data['status'] == true) {
      await _showSuccess();
      return;
    }
    _setError(data['message']?.toString() ?? 'ชำระเงินไม่สำเร็จ (${response.statusCode})');
  }

  Future<void> _showSuccess() async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: Colors.green, size: 56),
        title: const Text('ชำระเงินสำเร็จ'),
        content: Text('ชำระเงินคำสั่งซื้อ #${widget.orderID} เรียบร้อยแล้ว', textAlign: TextAlign.center),
        actions: [FilledButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('กลับหน้าหลัก'))],
      ),
    );
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const MainPage()), (route) => false);
  }

  void _setError(String message) {
    if (mounted) setState(() => _errorMessage = message);
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final amountText = NumberFormat('#,##0.00').format(widget.amount);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: AppBar(
        title: const Text('ชำระเงิน', style: TextStyle(fontWeight: FontWeight.bold)),
        foregroundColor: Colors.white,
        backgroundColor: _primary,
        elevation: 0,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF2F80ED), Color(0xFF56CCF2)]),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('คำสั่งซื้อ #${widget.orderID}', style: const TextStyle(color: Colors.white70)),
                    const SizedBox(height: 6),
                    Text('฿$amountText', style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold)),
                    const Text('ยอดที่ต้องชำระ', style: TextStyle(color: Colors.white70)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text('เลือกวิธีชำระเงิน', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              _methodTile(_Method.card, Icons.credit_card, 'บัตรเครดิต / เดบิต', 'Visa, Mastercard, JCB ผ่าน Omise'),
              const SizedBox(height: 10),
              _methodTile(_Method.slip, Icons.receipt_long, 'โอนเงิน / อัปโหลดสลิป', 'โอนผ่านแอปธนาคาร แล้วแนบสลิป'),
              const SizedBox(height: 20),
              if (_method == _Method.card) _buildCardSection() else _buildSlipSection(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _methodTile(_Method method, IconData icon, String title, String subtitle) {
    final selected = _method == method;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: _isProcessing ? null : () => setState(() {
        _method = method;
        _errorMessage = null;
      }),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? _primary.withValues(alpha: 0.06) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: selected ? _primary : Colors.black12, width: selected ? 2 : 1),
        ),
        child: Row(
          children: [
            Icon(icon, color: selected ? _primary : Colors.black54, size: 28),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(subtitle, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
            ),
            Icon(selected ? Icons.radio_button_checked : Icons.radio_button_off, color: selected ? _primary : Colors.black26),
          ],
        ),
      ),
    );
  }

  Widget _errorBox() => _errorMessage == null
      ? const SizedBox.shrink()
      : Container(
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              Icon(Icons.error_outline, color: Colors.red.shade700),
              const SizedBox(width: 8),
              Expanded(child: Text(_errorMessage!, style: TextStyle(color: Colors.red.shade700))),
            ],
          ),
        );

  Widget _payButton({required String label, required VoidCallback? onPressed, IconData icon = Icons.lock_outline}) {
    return FilledButton.icon(
      onPressed: _isProcessing ? null : onPressed,
      icon: _isProcessing
          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          : Icon(icon),
      label: Text(_isProcessing ? 'กำลังดำเนินการ...' : label),
      style: FilledButton.styleFrom(
        backgroundColor: _primary,
        padding: const EdgeInsets.symmetric(vertical: 16),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _buildCardSection() {
    final amountText = NumberFormat('#,##0.00').format(widget.amount);

    if (!kIsWeb) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('ระบบจะเปิดหน้ากรอกข้อมูลบัตรที่ปลอดภัยของ Omise', style: TextStyle(color: Colors.black54)),
          _errorBox(),
          const SizedBox(height: 16),
          _payButton(label: 'ชำระ ฿$amountText ด้วยบัตร', onPressed: _payWithCard),
        ],
      );
    }

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _field(
            controller: _cardNumberController,
            label: 'หมายเลขบัตร',
            hint: '4242 4242 4242 4242',
            icon: Icons.credit_card,
            keyboardType: TextInputType.number,
            formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(19), _CardNumberFormatter()],
            validator: (v) {
              final digits = (v ?? '').replaceAll(' ', '');
              if (digits.length < 13) return 'กรุณากรอกหมายเลขบัตรให้ครบ';
              if (!_luhnValid(digits)) return 'หมายเลขบัตรไม่ถูกต้อง';
              return null;
            },
          ),
          _field(
            controller: _cardholderNameController,
            label: 'ชื่อบนบัตร',
            hint: 'SOMCHAI JAIDEE',
            icon: Icons.person_outline,
            keyboardType: TextInputType.name,
            validator: (v) => (v ?? '').trim().isEmpty ? 'กรุณากรอกชื่อบนบัตร' : null,
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _field(
                  controller: _expiryController,
                  label: 'วันหมดอายุ',
                  hint: 'MM/YY',
                  icon: Icons.date_range,
                  keyboardType: TextInputType.number,
                  formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4), _ExpiryFormatter()],
                  validator: _validateExpiry,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _field(
                  controller: _securityCodeController,
                  label: 'CVV',
                  hint: '123',
                  icon: Icons.lock_outline,
                  keyboardType: TextInputType.number,
                  obscure: true,
                  formatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
                  validator: (v) => (v ?? '').length < 3 ? 'CVV 3-4 หลัก' : null,
                ),
              ),
            ],
          ),
          const Row(
            children: [
              Icon(Icons.verified_user_outlined, size: 16, color: Colors.green),
              SizedBox(width: 6),
              Expanded(child: Text('ข้อมูลบัตรส่งตรงไปยัง Omise ร้านค้าไม่เก็บข้อมูลบัตรของคุณ', style: TextStyle(fontSize: 12, color: Colors.black54))),
            ],
          ),
          _errorBox(),
          const SizedBox(height: 16),
          _payButton(label: 'ชำระ ฿$amountText', onPressed: _payWithCard),
        ],
      ),
    );
  }

  Widget _buildSlipSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('โอนเงินตามยอดด้านบน แล้วอัปโหลดรูปสลิปเพื่อให้เจ้าหน้าที่ตรวจสอบ', style: TextStyle(color: Colors.black54)),
        const SizedBox(height: 16),
        _payButton(
          label: 'ไปหน้าอัปโหลดสลิป',
          icon: Icons.upload_file,
          onPressed: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => SlipUploadPage(orderID: widget.orderID, amount: widget.amount)),
          ),
        ),
      ],
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    String? hint,
    IconData? icon,
    TextInputType? keyboardType,
    List<TextInputFormatter>? formatters,
    String? Function(String?)? validator,
    bool obscure = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        inputFormatters: formatters,
        validator: validator,
        obscureText: obscure,
        enabled: !_isProcessing,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          prefixIcon: icon == null ? null : Icon(icon),
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  String? _validateExpiry(String? value) {
    final parts = (value ?? '').split('/');
    if (parts.length != 2 || parts[0].length != 2 || parts[1].length != 2) return 'รูปแบบ MM/YY';
    final month = int.tryParse(parts[0]) ?? 0;
    final year = 2000 + (int.tryParse(parts[1]) ?? 0);
    if (month < 1 || month > 12) return 'เดือนไม่ถูกต้อง';
    final now = DateTime.now();
    if (year < now.year || (year == now.year && month < now.month)) return 'บัตรหมดอายุแล้ว';
    return null;
  }

  bool _luhnValid(String digits) {
    var sum = 0;
    var alternate = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var n = int.parse(digits[i]);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 == 0;
  }
}

/// 4242424242424242 -> 4242 4242 4242 4242
class _CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(' ', '');
    final buffer = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 == 0) buffer.write(' ');
      buffer.write(digits[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

/// 1230 -> 12/30
class _ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll('/', '');
    final text = digits.length > 2 ? '${digits.substring(0, 2)}/${digits.substring(2)}' : digits;
    return TextEditingValue(text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}
