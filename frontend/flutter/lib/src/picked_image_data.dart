import 'dart:typed_data';

class PickedImageData {
  final Uint8List bytes;
  final String fileName;

  const PickedImageData({required this.bytes, required this.fileName});
}
