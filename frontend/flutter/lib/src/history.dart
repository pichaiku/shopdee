import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'package:fl_chart/fl_chart.dart';
import 'api_config.dart';
import 'login.dart';
import 'order_detail.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  _HistoryPageState createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  List<dynamic> _historyOrders = [];
  bool _isLoading = true;
  List<Map<String, dynamic>> _spendingData = [];
  String? _selectedYear;
  bool _isLoadingYearData = false;
  bool _loggedIn = true;

  @override
  void initState() {
    super.initState();
    _fetchSpendingReport().then((_) {
      // Show last year's data by default when page loads
      if (_spendingData.isNotEmpty) {
        // Sort spending data by year to find the latest year
        _spendingData.sort((a, b) => a['year'].compareTo(b['year']));
        // Get the previous year (last year from the current date)
        final previousYear = (DateTime.now().year - 1).toString();
        
        // Check if previous year exists in the data, otherwise use the latest year in data
        final yearToShow = _spendingData.any((item) => item['year'] == previousYear) 
            ? previousYear 
            : _spendingData.last['year'];
            
        _fetchHistoryForYear(yearToShow);
      }
    });
  }

  Future<void> _fetchSpendingReport() async {
    // Set loading state
    setState(() {
      _isLoading = true;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      final custID = prefs.getInt('custID');
      final token = prefs.getString('token');

      if (custID == null || token == null) {
        setState(() {
          _isLoading = false;
          _loggedIn = false;
        });
        return;
      }

      // Call the spending report API
      final reportResponse = await http.get(
        Uri.parse('${ApiConfig.yearlySale}$custID'), // Update with your actual report API endpoint
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (reportResponse.statusCode == 200) {
        setState(() {
          _spendingData = List<Map<String, dynamic>>.from(jsonDecode(reportResponse.body));
          _isLoading = false;
        });
      } else {
        // If report API fails, still try to fetch regular history as fallback
        _fetchHistoryOrders();
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
        ),
      );
      // Try to fetch regular history as fallback
      _fetchHistoryOrders();
    }
  }

  Future<void> _fetchHistoryForYear(String year) async {
    try {
      setState(() {
        _isLoadingYearData = true;
        _selectedYear = year;
      });

      final prefs = await SharedPreferences.getInstance();
      final custID = prefs.getInt('custID');
      final token = prefs.getString('token');

      if (custID == null || token == null) {
        setState(() {
          _isLoadingYearData = false;
        });
        return;
      }

      // Assuming you have an API endpoint that can filter by year
      final response = await http.get(
        Uri.parse('${ApiConfig.history}$custID?year=$year'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        setState(() {
          _historyOrders = jsonDecode(response.body);
          _isLoadingYearData = false;
        });
      } else {
        throw Exception('Failed to fetch history orders for year $year');
      }
    } catch (e) {
      setState(() {
        _isLoadingYearData = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  Future<void> _fetchHistoryOrders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final custID = prefs.getInt('custID');
      final token = prefs.getString('token');

      if (custID == null || token == null) {
        setState(() {
          _isLoading = false;
          _loggedIn = false;
        });
        return;
      }

      final response = await http.get(
        Uri.parse('${ApiConfig.history}$custID'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        setState(() {
          _historyOrders = jsonDecode(response.body);
          _isLoading = false;
        });
      } else {
        throw Exception('Failed to fetch history orders');
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: ${e.toString()}'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  /// Shown instead of a "please log in" alert when the user is not logged in.
  Widget _buildLoginRequired() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.receipt_long_outlined, size: 80, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'ยังไม่มีประวัติการสั่งซื้อ',
              style: TextStyle(fontSize: 18, color: Colors.grey[600], fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'เข้าสู่ระบบเพื่อดูประวัติและติดตามสถานะคำสั่งซื้อของคุณ',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const LoginPage()),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2F80ED),
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('เข้าสู่ระบบ', style: TextStyle(fontSize: 16, color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('ประวัติการสั่งซื้อ',
            style: TextStyle(
              fontWeight: FontWeight.bold,
            )),
        foregroundColor: Colors.white,
        backgroundColor: const Color(0xFF2F80ED),
        automaticallyImplyLeading: false,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : !_loggedIn
          ? _buildLoginRequired()
          : SingleChildScrollView(
              child: Column(
                children: [
                  // Spending Report Bar Chart
                  if (_spendingData.isNotEmpty)
                    Card(
                      margin: const EdgeInsets.all(16),
                      elevation: 4,
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            const Text(
                              'รายงานค่าใช้จ่ายรายปี',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              height: 200,
                              child: _buildBarChart(),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'แตะที่แท่งกราฟเพื่อดูรายการประวัติการสั่งซื้อในปีนั้น ๆ',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                    
                  // Year title if a year is selected
                  if (_selectedYear != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Row(
                        children: [
                          Text(
                            'ประวัติการสั่งซื้อปี $_selectedYear',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _selectedYear = null;
                                _fetchHistoryOrders(); // Reset to show all orders
                              });
                            },
                            child: const Text('ดูทั้งหมด'),
                          ),
                        ],
                      ),
                    ),
                  
                  // Display loading indicator while fetching year data
                  if (_isLoadingYearData)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(16.0),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                  
                  // History orders list
                  if (!_isLoadingYearData && _historyOrders.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(32.0),
                      child: Center(
                        child: Text(
                          '',//ไม่มีประวัติการสั่งซื้อ
                          style: TextStyle(fontSize: 16, color: Colors.grey),
                        ),
                      ),
                    )
                  else if (!_isLoadingYearData)
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _historyOrders.length,
                      itemBuilder: (context, index) {
                        final order = _historyOrders[index];
                        return Card(
                          margin: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          child: ListTile(
                            title: Text(
                              'คำสั่งซื้อ #${order['orderID']}',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                Text('วันที่สั่งซื้อ: ${order['orderDate']}'),
                                Text('สถานะ: ${order['statusName']}'),
                                Text('จำนวนสินค้า: ${order['totalQuantity']}'),
                                Text(
                                  'ราคารวม: ฿${NumberFormat('#,##0.00').format(double.parse(order['totalPrice'].toString()))}',
                                ),
                              ],
                            ),
                            trailing: const Icon(Icons.arrow_forward_ios),
                            onTap: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      OrderDetailPage(orderID: order['orderID']),
                                ),
                              );
                              // refresh status after paying / uploading a slip
                              if (mounted) _fetchHistoryOrders();
                            },
                          ),
                        );
                      },
                    ),
                ],
              ),
            ),
    );
  }

  Widget _buildBarChart() {
    // Highlight the selected year bar with a different color
    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipColor: (BarChartGroupData group) => Colors.blueGrey,
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              return BarTooltipItem(
                '฿${NumberFormat('#,##0.00').format(double.parse(_spendingData[groupIndex]['totalSales'].toString()))}',
                const TextStyle(color: Colors.white),
              );
            },
          ),
          touchCallback: (FlTouchEvent event, barTouchResponse) {
            if (event is FlTapUpEvent && barTouchResponse != null && barTouchResponse.spot != null) {
              final spotIndex = barTouchResponse.spot!.touchedBarGroupIndex;
              if (spotIndex >= 0 && spotIndex < _spendingData.length) {
                _fetchHistoryForYear(_spendingData[spotIndex]['year'].toString());
              }
            }
          },
        ),
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                if (value.toInt() >= 0 && value.toInt() < _spendingData.length) {
                  return Text(_spendingData[value.toInt()]['year'].toString());
                }
                return const Text('');
              },
              reservedSize: 28,
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              getTitlesWidget: (value, meta) {
                // Simple formatting for y-axis values
                if (value == 0) return const Text('0');
                if (value % 1000 == 0) return Text('${value ~/ 1000}K');
                return Text('${value.toInt()}');
              },
            ),
          ),
          topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        borderData: FlBorderData(show: true),
        gridData: FlGridData(
          show: true,
          horizontalInterval: 1000,
        ),
        barGroups: List.generate(
          _spendingData.length,
          (index) => BarChartGroupData(
            x: index,
            barRods: [
              BarChartRodData(
                toY: double.parse(_spendingData[index]['totalSales'].toString()),
                color: _selectedYear == _spendingData[index]['year'].toString() 
                    ? Colors.orange 
                    : const Color(0xFF2F80ED),
                width: 22,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(4),
                  topRight: Radius.circular(4),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }

}