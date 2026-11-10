import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'api_config.dart';
import 'payment.dart';
import 'slip_upload.dart';

class OrderDetailPage extends StatefulWidget {
  final int orderID;

  const OrderDetailPage({super.key, required this.orderID});

  @override
  _OrderDetailPageState createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  Map<String, dynamic>? _orderInfo;
  List<dynamic> _orderDetails = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchOrderDetails();
  }

  Future<void> _fetchOrderDetails() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('token');
      final custID = prefs.getInt('custID');

      if (token == null) {
        throw Exception('Token is missing');
      }

      // Fetch order info
      final orderInfoResponse = await http.get(
        Uri.parse('${ApiConfig.orderinfo}$custID/${widget.orderID}'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      // Fetch order details
      final orderDetailResponse = await http.get(
        Uri.parse('${ApiConfig.orderdetail}$custID/${widget.orderID}'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (orderInfoResponse.statusCode == 200 &&
          orderDetailResponse.statusCode == 200) {
        setState(() {
          _orderInfo = jsonDecode(orderInfoResponse.body)[0];
          _orderDetails = jsonDecode(orderDetailResponse.body);
          _isLoading = false;
        });
      } else {
        throw Exception('Failed to fetch order details');
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),),
      );
    }
  }

  /// ปุ่มชำระเงินสำหรับคำสั่งซื้อที่ "รอชำระเงิน" (statusID = 1)
  Widget _buildPaymentActions() {
    final amount = double.parse(_orderInfo!['totalPrice'].toString());
    final orderID = widget.orderID;

    Future<void> open(Widget page) async {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => page));
      if (mounted) _fetchOrderDetails();
    }

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.schedule, color: Colors.orange),
              SizedBox(width: 8),
              Text('คำสั่งซื้อนี้รอการชำระเงิน', style: TextStyle(fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => open(PaymentPage(orderID: orderID, amount: amount)),
            icon: const Icon(Icons.credit_card),
            label: const Text('ชำระด้วยบัตรเครดิต'),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF2F80ED), padding: const EdgeInsets.symmetric(vertical: 14)),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => open(SlipUploadPage(orderID: orderID, amount: amount)),
            icon: const Icon(Icons.upload_file),
            label: const Text('อัปโหลดสลิปการโอนเงิน'),
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('รายละเอียดคำสั่งซื้อ',
          style: TextStyle(            
            fontWeight: FontWeight.bold,
          )),
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFF2F80ED),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _orderInfo == null
              ? const Center(
                  child: Text(
                    'ไม่พบข้อมูลคำสั่งซื้อ',
                    style: TextStyle(fontSize: 16, color: Colors.grey),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'คำสั่งซื้อ #${_orderInfo!['orderID']}',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text('วันที่สั่งซื้อ: ${_orderInfo!['orderDate']}'),
                      Text('สถานะ: ${_orderInfo!['statusName']}'),
                      Text('จำนวนสินค้า: ${_orderInfo!['totalQuantity']}'),
                      Text('ราคารวม: ฿${NumberFormat('#,##0.00').format(double.parse(_orderInfo!['totalPrice'].toString()))}'),
                      if (_orderInfo!['statusID'].toString() == '1') _buildPaymentActions(),
                      const SizedBox(height: 16),
                      const Text(
                        'รายการสินค้า',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _orderDetails.length,
                        itemBuilder: (context, index) {
                          final item = _orderDetails[index];
                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 8),
                            child: ListTile(
                              title: Text(item['productName']),
                              subtitle: Text( 
                                  'จำนวน: ${item['quantity']} x ฿${NumberFormat('#,##0.00').format(double.parse(item['price'].toString()))}'),
                              trailing: Text(
                                '฿${NumberFormat('#,##0.00').format(int.parse(item['quantity'].toString()) * double.parse(item['price'].toString()))}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
    );
  }
}