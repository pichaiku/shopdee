import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../main.dart';
import 'api_config.dart';

/// อัปโหลดสลิปการโอนเงิน ใช้ได้ทั้ง Web (Chrome) และ Android/iOS
/// - อ่านไฟล์เป็น bytes แล้วส่งแบบ multipart (ไม่ใช้ dart:io File จึงทำงานบนเว็บได้)
/// - Backend: POST /api/payment  fields: custID, orderID, price, slipFile
class SlipUploadPage extends StatefulWidget {
  final int orderID;
  final double amount;

  const SlipUploadPage({super.key, required this.orderID, required this.amount});

  @override
  State<SlipUploadPage> createState() => _SlipUploadPageState();
}

class _SlipUploadPageState extends State<SlipUploadPage> {
  static const _primary = Color(0xFF2F80ED);
  static const _maxBytes = 5 * 1024 * 1024; // 5 MB

  // TODO: เปลี่ยนเป็นบัญชีธนาคารจริงของร้าน
  static const _bankInfo = 'ธนาคาร: (ระบุธนาคารของร้าน)\nชื่อบัญชี: Shopdee\nเลขที่บัญชี: xxx-x-xxxxx-x';

  final ImagePicker _picker = ImagePicker();
  Uint8List? _bytes;
  String? _fileName;
  bool _uploading = false;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    setState(() => _error = null);
    try {
      final XFile? file = await _picker.pickImage(source: source, imageQuality: 85, maxWidth: 2000);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      if (bytes.length > _maxBytes) {
        setState(() => _error = 'ไฟล์มีขนาดใหญ่เกิน 5 MB กรุณาเลือกไฟล์ใหม่');
        return;
      }
      setState(() {
        _bytes = bytes;
        _fileName = file.name.isNotEmpty ? file.name : 'slip_${DateTime.now().millisecondsSinceEpoch}.jpg';
      });
    } catch (e) {
      setState(() => _error = 'ไม่สามารถเลือกรูปภาพได้: $e');
    }
  }

  MediaType _mediaTypeFor(String name) {
    final ext = name.split('.').last.toLowerCase();
    switch (ext) {
      case 'png':
        return MediaType('image', 'png');
      case 'gif':
        return MediaType('image', 'gif');
      case 'webp':
        return MediaType('image', 'webp');
      default:
        return MediaType('image', 'jpeg');
    }
  }

  /// ชื่อไฟล์ต้องมีนามสกุลเดียวและไม่มีจุดเกิน เพราะ backend ใช้ split('.') ตั้งชื่อไฟล์ใหม่
  String _safeFileName(String name) {
    final parts = name.split('.');
    final ext = parts.length > 1 ? parts.last.toLowerCase() : 'jpg';
    final base = parts.length > 1 ? parts.sublist(0, parts.length - 1).join('_') : name;
    final cleaned = base.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    return '${cleaned.isEmpty ? 'slip' : cleaned}.$ext';
  }

  Future<void> _upload() async {
    if (_bytes == null || _fileName == null) {
      setState(() => _error = 'กรุณาเลือกรูปสลิปก่อน');
      return;
    }
    setState(() {
      _uploading = true;
      _error = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      final custID = prefs.getInt('custID');
      final token = prefs.getString('token');
      if (custID == null || token == null) {
        setState(() => _error = 'กรุณาเข้าสู่ระบบก่อน');
        return;
      }

      final fileName = _safeFileName(_fileName!);
      final request = http.MultipartRequest('POST', Uri.parse(ApiConfig.payment))
        ..headers['Authorization'] = 'Bearer $token'
        ..fields['custID'] = custID.toString()
        ..fields['orderID'] = widget.orderID.toString()
        ..fields['price'] = widget.amount.toStringAsFixed(2)
        ..files.add(http.MultipartFile.fromBytes(
          'slipFile',
          _bytes!,
          filename: fileName,
          contentType: _mediaTypeFor(fileName),
        ));

      final streamed = await request.send().timeout(const Duration(seconds: 30));
      final response = await http.Response.fromStream(streamed);
      final data = response.body.isNotEmpty ? jsonDecode(response.body) : {};

      if (response.statusCode == 200 && data['status'] == true) {
        if (!mounted) return;
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            icon: const Icon(Icons.check_circle, color: Colors.green, size: 56),
            title: const Text('ส่งสลิปเรียบร้อย'),
            content: const Text('ระบบได้รับสลิปของคุณแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบการชำระเงิน', textAlign: TextAlign.center),
            actions: [
              FilledButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('ตกลง'),
              ),
            ],
          ),
        );
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainPage()),
          (route) => false,
        );
        return;
      }
      setState(() => _error = (data is Map ? data['message'] : null)?.toString() ?? 'อัปโหลดสลิปไม่สำเร็จ (${response.statusCode})');
    } catch (e) {
      setState(() => _error = 'การเชื่อมต่อเซิร์ฟเวอร์ล้มเหลว: $e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final amountText = NumberFormat('#,##0.00').format(widget.amount);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: AppBar(
        title: const Text('อัปโหลดสลิปการโอนเงิน', style: TextStyle(fontWeight: FontWeight.bold)),
        foregroundColor: Colors.white,
        backgroundColor: _primary,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('คำสั่งซื้อ #${widget.orderID}', style: const TextStyle(color: Colors.black54)),
                      const SizedBox(height: 4),
                      Text('ยอดที่ต้องโอน ฿$amountText',
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: _primary)),
                      const Divider(height: 24),
                      const Text('โอนเงินเข้าบัญชี', style: TextStyle(fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      const Text(_bankInfo, style: TextStyle(height: 1.5)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _uploading ? null : () => _pick(ImageSource.gallery),
                child: Container(
                  height: 320,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _bytes == null ? Colors.black26 : _primary, width: _bytes == null ? 1 : 2),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _bytes == null
                      ? const Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.receipt_long, size: 64, color: Colors.black26),
                            SizedBox(height: 12),
                            Text('แตะเพื่อเลือกรูปสลิป', style: TextStyle(fontWeight: FontWeight.w600)),
                            SizedBox(height: 4),
                            Text('รองรับ JPG / PNG ขนาดไม่เกิน 5 MB', style: TextStyle(color: Colors.black45, fontSize: 12)),
                          ],
                        )
                      : Image.memory(_bytes!, fit: BoxFit.contain),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _uploading ? null : () => _pick(ImageSource.gallery),
                      icon: const Icon(Icons.photo_library_outlined),
                      label: Text(kIsWeb ? 'เลือกไฟล์' : 'คลังรูปภาพ'),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                    ),
                  ),
                  if (!kIsWeb) ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _uploading ? null : () => _pick(ImageSource.camera),
                        icon: const Icon(Icons.photo_camera_outlined),
                        label: const Text('ถ่ายรูป'),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                      ),
                    ),
                  ],
                ],
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(12)),
                  child: Text(_error!, style: TextStyle(color: Colors.red.shade700)),
                ),
              ],
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _uploading || _bytes == null ? null : _upload,
                icon: _uploading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.cloud_upload_outlined),
                label: Text(_uploading ? 'กำลังอัปโหลด...' : 'ส่งสลิป'),
                style: FilledButton.styleFrom(
                  backgroundColor: _primary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
