import 'dart:convert';
import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';
import 'dart:ui_web' as ui;

import 'package:flutter/material.dart';
import 'package:web/web.dart' as web;

import 'picked_image_data.dart';

int _cameraViewId = 0;

Future<PickedImageData?> pickWebCameraImage([BuildContext? context]) async {
  if (context == null) {
    return null;
  }

  final web.MediaStream? stream = await _openWebcamStream();
  if (stream == null) {
    return null;
  }

  final web.HTMLVideoElement videoElement =
      web.HTMLVideoElement()
        ..autoplay = true
        ..muted = true
        ..playsInline = true
        ..style.width = '100%'
        ..style.height = '100%'
        ..style.objectFit = 'cover'
        ..srcObject = stream;
  unawaited(videoElement.play().toDart);

  final String viewType = 'webcam-preview-${_cameraViewId++}';
  ui.platformViewRegistry.registerViewFactory(
    viewType,
    (int viewId) => videoElement,
  );

  Future<void> stopStream() async {
    for (final track in stream.getTracks().toDart) {
      track.stop();
    }
  }

  try {
    final PickedImageData? result = await showDialog<PickedImageData?>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Text(
                    'เปิดกล้องถ่ายรูป',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                AspectRatio(
                  aspectRatio: 4 / 3,
                  child: Container(
                    color: Colors.black,
                    child: HtmlElementView(viewType: viewType),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(
                        onPressed: () {
                          Navigator.of(dialogContext).pop(null);
                        },
                        child: const Text('ยกเลิก'),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: () {
                          final int width = videoElement.videoWidth;
                          final int height = videoElement.videoHeight;
                          if (width <= 0 || height <= 0) {
                            Navigator.of(dialogContext).pop(null);
                            return;
                          }

                          final web.HTMLCanvasElement canvas =
                              web.HTMLCanvasElement()
                                ..width = width
                                ..height = height;
                          final web.CanvasRenderingContext2D? context2D =
                              canvas.getContext('2d')
                                  as web.CanvasRenderingContext2D?;
                          if (context2D == null) {
                            Navigator.of(dialogContext).pop(null);
                            return;
                          }
                          context2D.drawImage(
                            videoElement,
                            0,
                            0,
                            width,
                            height,
                          );

                          final String dataUrl = canvas.toDataURL(
                            'image/jpeg',
                            0.92.toJS,
                          );
                          final List<int> bytes = base64Decode(
                            dataUrl.split(',').last,
                          );
                          Navigator.of(dialogContext).pop(
                            PickedImageData(
                              bytes: Uint8List.fromList(bytes),
                              fileName:
                                  'webcam_${DateTime.now().millisecondsSinceEpoch}.jpg',
                            ),
                          );
                        },
                        child: const Text('ถ่ายรูป'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    return result;
  } finally {
    await stopStream();
  }
}

Future<web.MediaStream?> _openWebcamStream() async {
  try {
    return await web.window.navigator.mediaDevices
        .getUserMedia(
          web.MediaStreamConstraints(
            video: web.MediaTrackConstraints(facingMode: 'user'.toJS),
            audio: false.toJS,
          ),
        )
        .toDart;
  } catch (_) {
    return null;
  }
}
