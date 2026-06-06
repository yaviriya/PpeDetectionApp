import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Platform,
  PermissionsAndroid,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Camera, CameraRef, useCameraDevice } from 'react-native-vision-camera';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import RNFS from 'react-native-fs';

const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.45;
const NMS_IOU_THRESHOLD = 0.45;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CLASS_NAMES: Record<number, string> = {
  0: 'Fall-Detected',
  1: 'Hardhat',
  2: 'NO-Hardhat',
  3: 'Safety Cone',
  4: 'vest',
};

type Detection = {
  label: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function getBoxColor(label: string): string {
  if (label === 'Hardhat') return '#00FF00';
  if (label === 'NO-Hardhat') return '#FF0000';
  return '#FFFF00';
}

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  if (x2 <= x1 || y2 <= y1) return 0;
  const inter = (x2 - x1) * (y2 - y1);
  const aArea = (a.x2 - a.x1) * (a.y2 - a.y1);
  const bArea = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (aArea + bArea - inter);
}

function applyNMS(detections: Detection[]): Detection[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: Detection[] = [];
  for (const det of sorted) {
    if (!kept.some(k => iou(det, k) > NMS_IOU_THRESHOLD)) {
      kept.push(det);
    }
  }
  return kept;
}

function parseDetections(data: Float32Array): Detection[] {
  const numAnchors = 8400;
  const numClasses = Object.keys(CLASS_NAMES).length;
  const results: Detection[] = [];

  for (let i = 0; i < numAnchors; i++) {
    let maxScore = 0;
    let classIdx = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numAnchors + i];
      if (score > maxScore) {
        maxScore = score;
        classIdx = c;
      }
    }
    if (maxScore < CONFIDENCE_THRESHOLD) continue;

    const cx = data[0 * numAnchors + i];
    const cy = data[1 * numAnchors + i];
    const w  = data[2 * numAnchors + i];
    const h  = data[3 * numAnchors + i];

    results.push({
      label: CLASS_NAMES[classIdx],
      confidence: maxScore,
      x1: ((cx - w / 2) / INPUT_SIZE) * SCREEN_W,
      y1: ((cy - h / 2) / INPUT_SIZE) * SCREEN_H,
      x2: ((cx + w / 2) / INPUT_SIZE) * SCREEN_W,
      y2: ((cy + h / 2) / INPUT_SIZE) * SCREEN_H,
    });
  }
  return applyNMS(results);
}

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [session, setSession] = useState<InferenceSession | null>(null);
  const [statusText, setStatusText] = useState('กำลังโหลดโมเดล...');
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
  const [inferenceMs, setInferenceMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const device = useCameraDevice(cameraPosition);
  const camera = useRef<CameraRef>(null);
  const isDetecting = useRef(false);

  useEffect(() => {
    requestPermissions();
    loadModel();
  }, []);

  useEffect(() => {
    if (!session) return;
    setStatusText('');
  }, [session]);

  useEffect(() => {
    if (!session || !isRunning) return;
    const interval = setInterval(() => {
      runDetection();
    }, 200);
    return () => clearInterval(interval);
  }, [session, isRunning]);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    }
  };

  const loadModel = async () => {
    try {
      const dest = `${RNFS.DocumentDirectoryPath}/best_22032026.onnx`;
      const exists = await RNFS.exists(dest);
      if (!exists) {
        await RNFS.copyFileAssets('best_22032026.onnx', dest);
      }
      const sess = await InferenceSession.create(dest);
      setSession(sess);
    } catch (e) {
      console.error('Failed to load model:', e);
      setStatusText('โหลดโมเดลไม่สำเร็จ');
    }
  };

  const runDetection = useCallback(async () => {
    if (isDetecting.current || !session || !camera.current) return;
    isDetecting.current = true;
    try {
      // จับ snapshot จากกล้อง
      const image = await camera.current.takeSnapshot();

      // resize เป็น 640x640
      const resized = await image.resizeAsync(INPUT_SIZE, INPUT_SIZE);

      // ดึง raw pixel data (BGRA format บน Android)
      const rawPixel = await resized.toRawPixelDataAsync();
      const pixels = new Uint8Array(rawPixel.buffer);
      const isBGRA = rawPixel.pixelFormat === 'BGRA';

      // แปลงเป็น Float32Array [1, 3, 640, 640] RGB normalized 0-1
      const input = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
      for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
        const base = i * 4;
        const r = isBGRA ? pixels[base + 2] : pixels[base];
        const g = pixels[base + 1];
        const b = isBGRA ? pixels[base] : pixels[base + 2];
        input[0 * INPUT_SIZE * INPUT_SIZE + i] = r / 255;
        input[1 * INPUT_SIZE * INPUT_SIZE + i] = g / 255;
        input[2 * INPUT_SIZE * INPUT_SIZE + i] = b / 255;
      }

      // รัน inference + วัดเวลา
      const tensor = new Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);
      const t0 = Date.now();
      const result = await session.run({ images: tensor });
      setInferenceMs(Date.now() - t0);
      const outputData = result.output0.data as Float32Array;
      setDetections(parseDetections(outputData));
    } catch (e) {
      console.error('Detection error:', e);
    } finally {
      isDetecting.current = false;
    }
  }, [session]);

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>ต้องการสิทธิ์เข้าถึงกล้อง</Text>
      </View>
    );
  }

  if (!isRunning) {
    return (
      <View style={styles.homeScreen}>
        <Text style={styles.homeTitle}>PPE Detection</Text>
        <Text style={styles.homeSubtitle}>ระบบตรวจจับอุปกรณ์ป้องกันส่วนบุคคล</Text>
        <TouchableOpacity
          style={[styles.inferenceButton, !session && styles.inferenceButtonDisabled]}
          onPress={() => setIsRunning(true)}
          disabled={!session}>
          <Text style={styles.inferenceButtonText}>
            {session ? '▶ Inference' : 'กำลังโหลดโมเดล...'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>ไม่พบกล้อง</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
      />
      {detections.map((det, i) => (
        <View
          key={i}
          style={[
            styles.box,
            {
              left: det.x1,
              top: det.y1,
              width: det.x2 - det.x1,
              height: det.y2 - det.y1,
              borderColor: getBoxColor(det.label),
            },
          ]}>
          <Text style={[styles.label, { color: getBoxColor(det.label) }]}>
            {det.label} {det.confidence.toFixed(2)}
          </Text>
        </View>
      ))}
      {inferenceMs > 0 && (
        <View style={styles.fpsOverlay}>
          <Text style={styles.fpsText}>
            {(1000 / inferenceMs).toFixed(1)} FPS  ·  {inferenceMs} ms
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.flipButton}
        onPress={() => setCameraPosition(p => (p === 'back' ? 'front' : 'back'))}>
        <Text style={styles.flipButtonText}>
          {cameraPosition === 'back' ? '🔄 หน้า' : '🔄 หลัง'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.startButton, styles.stopButton]}
        onPress={() => {
          setIsRunning(false);
          setDetections([]);
          setInferenceMs(0);
        }}>
        <Text style={styles.startButtonText}>⏸ Stop</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  text: { color: '#fff', fontSize: 16 },
  box: { position: 'absolute', borderWidth: 2 },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
  },
  statusOverlay: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 8,
  },
  flipButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
  },
  flipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fpsOverlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fpsText: {
    color: '#00FF00',
    fontSize: 14,
    fontWeight: 'bold',
  },
  startButton: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
  },
  playButton: {
    backgroundColor: 'rgba(0,200,83,0.9)',
  },
  stopButton: {
    backgroundColor: 'rgba(229,57,53,0.9)',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  homeScreen: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  homeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#42A5F5',
    marginBottom: 8,
  },
  homeSubtitle: {
    fontSize: 16,
    color: '#B0BEC5',
    marginBottom: 60,
  },
  inferenceButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#42A5F5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  inferenceButtonDisabled: {
    backgroundColor: '#37474F',
  },
  inferenceButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
