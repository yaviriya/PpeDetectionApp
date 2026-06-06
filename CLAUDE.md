# PPE Detection App

แอป Android สำหรับตรวจจับอุปกรณ์ป้องกันส่วนบุคคล (PPE) แบบ real-time ผ่านกล้องสมาร์ทโฟน โดยใช้โมเดล YOLOv8 ที่เทรนแล้ว

## เป้าหมายของโปรเจค

สร้าง Android App ที่:
- เปิดกล้องของสมาร์ทโฟน
- ตรวจจับ PPE แบบ real-time ด้วยโมเดล YOLO
- แสดง bounding box พร้อม label บนหน้าจอ

## โครงสร้างโปรเจค

```
PpeDetectionApp/
├── App.tsx                          # หน้าจอหลัก + detection logic
├── android/
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml      # permissions (CAMERA)
│   │   └── assets/
│   │       └── best_22032026.onnx   # โมเดล YOLO (11.7MB)
│   ├── gradle.properties            # org.gradle.java.home ชี้ไป JDK 17
│   └── local.properties             # sdk.dir ชี้ไป Android SDK
└── captureScreen/                   # screenshots สำหรับ debug
```

## Tech Stack

| เทคโนโลยี | รายละเอียด |
|-----------|-----------|
| React Native 0.85 | framework หลัก |
| react-native-vision-camera v5 | เปิดกล้อง + จับ frame |
| onnxruntime-react-native | รัน YOLO model |
| react-native-fs | อ่าน/เขียนไฟล์, copy asset |
| react-native-nitro-modules | dependency ของ vision-camera v5 |
| react-native-nitro-image | dependency ของ vision-camera v5 |
| react-native-worklets-core | dependency ของ vision-camera v5 |

## คลาสที่ตรวจจับได้

| Class | สีกรอบ | ความหมาย |
|-------|--------|----------|
| Hardhat | เขียว | สวมหมวกนิรภัย |
| NO-Hardhat | แดง | ไม่สวมหมวกนิรภัย |
| vest | เหลือง | เสื้อกั๊กนิรภัย |
| Safety Cone | เหลือง | กรวยนิรภัย |
| Fall-Detected | เหลือง | ตรวจจับการล้ม |

## สิ่งที่ทำเสร็จแล้ว

- [x] แปลงโมเดล `best_22032026.pt` → `best_22032026.onnx`
- [x] สร้าง React Native project
- [x] ติดตั้ง library ทั้งหมด
- [x] กล้องทำงานได้บน emulator
- [x] โมเดล ONNX โหลดได้สำเร็จ (copy จาก assets ไป DocumentDirectory)
- [x] เขียน detection logic ใน App.tsx (snapshot → resizeAsync → toRawPixelDataAsync → inference → bounding box)
- [x] ทดสอบบน emulator ได้ผลแล้ว — ตรวจจับได้และแสดง bounding box พร้อม label และ confidence ทศนิยม 2 ตำแหน่ง
- [x] ทดสอบบนเครื่อง Android จริง (Samsung Galaxy S26, Android 15) — แอปรันได้สำเร็จ
- [x] แก้ปัญหา detection ผิดพลาด — เพิ่ม NMS + ปรับ confidence threshold 0.25 → 0.45
- [x] ทดสอบบน Samsung Galaxy S23 Ultra (Android 16) — แอปรันได้สำเร็จ, กล้อง + bounding box ทำงานปกติ (เครื่องเทสต์เฉพาะของโปรเจค)

## ผลเทสต์ FPS (วัดบน S23 Ultra)

| โมเดล | FPS | inference | หมายเหตุ |
|-------|-----|-----------|----------|
| **YOLO26s** (4 คลาส) | ~3.4–4.2 | 236–296ms | ใหญ่ 36.4MB, เริ่มกระตุก |
| **YOLOv8s** (5 คลาส, `best_22032026`) | **~10 FPS** | **~95ms** | เล็ก 12.2MB, ลื่นกว่า **~2.6 เท่า** |

→ สรุป: **YOLOv8s เร็วกว่า YOLO26s ชัดเจน** เลยตัดสินใจเทรน YOLOv8s 4 คลาสใหม่

## สิ่งที่ยังต้องทำ

- [ ] **เทรน YOLOv8s 4 คลาส** (Fall-Detected, Hardhat, NO-Hardhat, Safety-Cone — ตัด vest) — กำลังเทรนบน **Google Colab**
- [ ] **พอได้ `.pt` แล้ว → แปลงเป็น onnx** (`yolo export format=onnx imgsz=640 opset=19` ผ่าน onnxslim) → swap แทน `best_22032026.onnx` ใน `assets/` → **build ใหม่ (gradlew installDebug)** → เช็ค `CLASS_NAMES` 4 คลาสให้ index ตรงกับ `model.names` + output shape เป็น `[1, 8, 8400]` (4 bbox + 4 คลาส)
- [ ] **เทสต์ 2 แบบ เทียบผล detect (Hardhat / NO-Hardhat / Safety-Cone / Fall-Detected):**
  - 4.1 **โค้ดปัจจุบัน (stretch resize)** — ดูว่าโมเดล YOLOv8s ทนการ resize ยืดได้ดีแค่ไหน
  - 4.2 **letterbox fix** — โค้ด letterbox อยู่ใน git history commit `c8ae469` (กู้กลับ/cherry-pick ได้) เทียบผลกับ 4.1 ว่า fix ช่วยมากน้อยแค่ไหน
- [ ] ทดสอบความแม่นยำ detection บนเครื่องจริงหลัง NMS + threshold

## วิธีทดสอบบน Android จริง

1. เปิด Developer Mode: Settings → About Phone → กด Build Number 7 ครั้ง
2. เปิด USB Debugging: Settings → Developer Options → USB Debugging
3. ปิด Auto Blocker: Settings → Security and Privacy → Auto Blocker → OFF
4. เชื่อมต่อมือถือกับคอมด้วยสาย USB → เลือก File Transfer (MTP)
5. กด Allow USB Debugging บนมือถือ
6. เช็คว่าเครื่องเจอ: `adb devices`
7. เปิด Metro ใน **terminal 1** (เปิดทิ้งไว้):
   ```powershell
   cd D:\Coding\ppedetect_project\PpeDetectionApp
   npx react-native start --port 8081
   ```
8. **terminal 2** — build + install + เปิดแอป (แบบแมนวล แนะนำ):
   ```powershell
   cd D:\Coding\ppedetect_project\PpeDetectionApp
   adb reverse tcp:8081 tcp:8081
   cd android
   .\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
   ```
   เมื่อเห็น `BUILD SUCCESSFUL` แล้ว เปิดแอป:
   ```powershell
   cd ..
   adb shell monkey -p com.ppedetectionapp -c android.intent.category.LAUNCHER 1
   ```
   - **สำคัญสุด: ถ้าเปลี่ยนไฟล์โมเดลใน `assets/` ต้อง build ใหม่ (gradlew installDebug) เสมอ** — รัน Metro/Fast Refresh เฉยๆ ไม่พอ เพราะโมเดลฝังใน APK ตอน build (ไม่งั้นแอปจะหา onnx ใน APK ไม่เจอ → "โหลดโมเดลไม่สำเร็จ")
   - ใช้ `.\gradlew.bat` (มี `.\` นำหน้า) — RN CLI เรียกแบบไม่มีจะ error `'gradlew.bat' is not recognized`
   - ใช้ port **8081** (default ของ RN) — ถ้าจะเปลี่ยนต้องตรงกันทั้ง 3 จุด: Metro `--port`, `adb reverse`, `-PreactNativeDevServerPort`
   - **อย่าใช้ `npx react-native run-android` ตอน Metro รันอยู่แล้ว** — มันเด้งถาม port, ตอบ **Y = เปิด Metro ตัวที่สอง** (ตอบ N ถึงจะใช้ตัวเดิม). แมนวล gradlew เลี่ยงปัญหานี้ทั้งหมด
9. ถ้าเจอ dialog เตือน 16KB page size จาก Samsung → กด dismiss ได้เลย (แค่ warning ไม่ใช่ crash)

## การรันโปรเจค

1. เปิด Android Studio → Device Manager → กด ▶️ เพื่อเปิด emulator
2. รอ emulator บูทขึ้นมา
3. รันคำสั่ง:
```powershell
cd D:\Coding\PpeDetectionApp
npx react-native run-android
```

## Environment ที่ติดตั้งไว้

- Node.js v22.11.0
- JDK 17 (`C:\Program Files\Java\jdk-17`)
- Android Studio + SDK (`C:\Users\amari\AppData\Local\Android\Sdk`)
- Emulator: Pixel 8 API 34 (Android 14)

## โมเดล YOLO

- ต้นทาง: `D:\Coding\ppe_obj_detection\model\best_22032026.pt`
- ONNX ที่ใช้ใน App: `D:\Coding\PpeDetectionApp\android\app\src\main\assets\best_22032026.onnx`
- Runtime: app จะ copy จาก assets ไปไว้ที่ `DocumentDirectory` ตอนเปิดครั้งแรก
- Input: `[1, 3, 640, 640]` float32, normalized 0-1, CHW format
- Input name: `images`
- Output name: `output0`, shape `[1, 9, 8400]`
- Confidence threshold: 0.25

## Core Principles

1. **Never Guess** - อ่านโค้ดก่อนตอบ อย่าเดา
2. **Find Root Cause** - หาสาเหตุที่แท้จริง ไม่ใช่แค่แก้อาการ
3. **Minimize Changes** - ทำเฉพาะที่ขอ ไม่ over-engineer
4. การแก้ไข System.Environment ทุกครั้งให้ทำการแก้ผ่านหน้าจอ GUI (System Properties) เสมอ เพราะการแก้ผ่าน PowerShell ด้วย SetEnvironmentVariable จะเขียนทับ Path เดิมทั้งหมด ทำให้ node, git, ngrok และอื่นๆ หายไปจาก Path
5. ถ้าบอกให้ดู error จากรูปภาพ ให้เข้าไปดูในโฟลเดอร์ `D:\Coding\PpeDetectionApp\captureScreen`

## บุคลิกของผู้ช่วย

ผู้ช่วย AI ในโปรเจคนี้มีนิสัยร่าเริง เป็นกันเอง และสุภาพ พูดคุยด้วยความเป็นมิตร ใช้ภาษาที่เข้าใจง่าย และพร้อมช่วยเหลือเสมอด้วยความยินดี

## ผู้พัฒนา

ยะ & Claude
