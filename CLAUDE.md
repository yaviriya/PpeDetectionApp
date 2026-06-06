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
│   │       └── best_01062026_1057pm.onnx   # โมเดล YOLO ที่ใช้งาน (36.4MB)
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

โมเดลปัจจุบัน (best_01062026_1057pm) มี 4 คลาส (ตัด vest ออกจากโมเดลเก่า)

| Class | index | สีกรอบ | ความหมาย |
|-------|-------|--------|----------|
| Fall-Detected | 0 | เหลือง | ตรวจจับการล้ม |
| Hardhat | 1 | เขียว | สวมหมวกนิรภัย |
| NO-Hardhat | 2 | แดง | ไม่สวมหมวกนิรภัย |
| Safety-Cone | 3 | เหลือง | กรวยนิรภัย |

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
- [x] เปลี่ยนมาใช้โมเดลใหม่ `best_01062026_1057pm` (4 คลาส) — แปลง onnx, ฝัง asset, แก้ CLASS_NAMES + ชื่อไฟล์ใน App.tsx
- [x] build + ทดสอบโมเดลใหม่ `best_01062026_1057pm` บน S23 Ultra สำเร็จ — กล้อง + bounding box + label ทำงานปกติ (NO-Hardhat สีแดงแสดงถูก), วัดได้ ~3.7 FPS / 270ms
- [x] **แก้บั๊ก "เห็น NO-Hardhat แต่ไม่เห็น Hardhat"** — ต้นเหตุคือ preprocessing resize แบบ "ยืดภาพ" (stretch) ทำให้สัดส่วนเพี้ยน โมเดล (เทรนด้วย letterbox) คะแนน Hardhat ตก (0.01) แต่ไปเดา NO-Hardhat สูงกว่า → เปลี่ยนเป็น **letterbox** (resize รักษาสัดส่วน + เติมขอบเทา 114) + ถอดพิกัด box ตาม padding/scale → Hardhat ขึ้น 0.39-0.70 ถูกต้อง (Python letterbox ได้ 0.897). พิสูจน์ด้วย `onnxruntime` ใน Python: stretch=0.245 vs letterbox=0.897

## สิ่งที่ยังต้องทำ

- [ ] **แก้ Safety-Cone confusion** — หมวกนิรภัย**สีแดง**บางเฟรมโดนเดาเป็น `Safety-Cone` (0.36-0.59) สลับกับ `Hardhat` เพราะสีแดง/ส้มคล้ายกรวย (ดูรูป `captureScreen/_hardhat_as_safetycone.png`). ใน Python (letterbox สะอาด) Safety-Cone แค่ 0.023 vs Hardhat 0.897 → ปัญหาส่วนใหญ่มาจากภาพกล้องสด (เบลอ/มุม/แสง). แนวทางลองรอบหน้า (เรียงจากง่าย→ดีสุด):
  1. **per-class threshold** — ตั้ง threshold ของ Safety-Cone สูงขึ้น (เช่น 0.5-0.6) ให้กรองตัวอ่อนๆ ทิ้ง (โค้ดตอนนี้ใช้ `CONFIDENCE_THRESHOLD` ตัวเดียวทุกคลาส = 0.35)
  2. **class-aware NMS** — ถ้ากรอบ Safety-Cone ซ้อนกับ Hardhat ในบริเวณหัว ให้ตัด Safety-Cone ทิ้ง (NMS ตอนนี้เป็น class-agnostic อยู่แล้ว แต่เลือกตัว conf สูงสุด — บางเฟรม Safety-Cone ดันสูงกว่า)
  3. **เพิ่ม FPS/คุณภาพภาพ** — ภาพคมขึ้น (เบลอน้อยลง) จะลด confusion เอง
  4. **ดีสุด: เทรนใหม่** — เพิ่มภาพหมวกแดงในชุดเทรน + ใส่กรวยจริงให้โมเดลแยกออก
- [ ] **เทรนโมเดลใหม่ด้วย YOLOv8s แล้วลองในแอป** (เผื่อ inference เร็วขึ้น) — โมเดลปัจจุบันเป็น **YOLO26s** (36.4MB) ได้ ~3.7-4.0 FPS / 233-360ms. **เกร็ด: ตอนรันโมเดลเก่า `best_22032026.onnx` ที่เป็น YOLOv8s (12.2MB, เล็กกว่า 3 เท่า) รันลื่นกว่านี้ชัดเจน**. แผน: เทรน YOLOv8s บนชุดข้อมูล 4 คลาสเดิม → export onnx (`imgsz=640 opset=19` ผ่าน onnxslim) → swap ไฟล์ใน assets + เช็ค `CLASS_NAMES` ให้ index ตรงกับ `model.names`. **หมายเหตุสำคัญ: แอปตอนนี้ทำ letterbox แล้ว** (แก้ไปรอบนี้) เลยแค่สลับไฟล์ onnx ได้เลย ไม่ต้องแก้ preprocessing
  - ❌ **ทดลอง execution provider แล้ว (6 มิ.ย. 2026) — ไม่ช่วย อย่าลองซ้ำ:**
    - **NNAPI** → build ไม่ได้ error `op_builder_helpers.cc:144 AddNnapiSplit count [0] does not evenly divide dimension 3 [64]` (Split op ใน detection head ของ YOLO ไม่รองรับ) → โยน error fallback CPU
    - **XNNPACK** → โหลดได้แต่**ช้ากว่า 2 เท่า** (~550ms / 1.7-1.8 FPS เทียบ CPU ~250ms / 3.4-4.2 FPS)
    - **สรุป: CPU (default) เร็วสุดสำหรับ YOLO26s นี้** — การเร่งจริงต้องไปทางโมเดลเล็กลง (YOLOv8s) หรือ quantize เท่านั้น
- [ ] ทำเป็นไฟล์ APK (ตอนนี้รันผ่าน USB/Metro เท่านั้น)
- [ ] แจ้งเตือนผ่าน Line หรือ Telegram — เงื่อนไขเป็น OR ทั้งหมด: เจอ `NO-Hardhat` **หรือ** เจอ `Fall-Detected` **หรือ** ไม่เจอ `Safety-Cone` → ส่ง alert
  - หมายเหตุ: ข้อ "ไม่เจอ Safety-Cone" แบบ OR จะ trigger แทบทุกเฟรม (เพราะปกติไม่มีกรวยในภาพ) — ตอนทำจริงควรเช็กกับเจ้าของงานอีกที + ต้องมี cooldown กัน spam และเลือก Line/Telegram ก่อน

## วิธีทดสอบบน Android จริง

1. เปิด Developer Mode: Settings → About Phone → กด Build Number 7 ครั้ง
2. เปิด USB Debugging: Settings → Developer Options → USB Debugging
3. ปิด Auto Blocker: Settings → Security and Privacy → Auto Blocker → OFF
4. เชื่อมต่อมือถือกับคอมด้วยสาย USB → เลือก File Transfer (MTP)
5. กด Allow USB Debugging บนมือถือ
6. เช็คว่าเครื่องเจอ: `adb devices`
7. เปิด Metro ใน terminal 1: `npx react-native start`
8. รันใน terminal 2: `npx react-native run-android --port 8083`
9. ถ้าเจอ dialog เตือน 16KB page size จาก Samsung → กด dismiss ได้เลย (แค่ warning ไม่ใช่ crash)

## การรันโปรเจค

1. เปิด Android Studio → Device Manager → กด ▶️ เพื่อเปิด emulator
2. รอ emulator บูทขึ้นมา
3. รันคำสั่ง:
```powershell
cd D:\Coding\ppedetect_project\PpeDetectionApp
npx react-native run-android
```

## Environment ที่ติดตั้งไว้

- Node.js v22.11.0
- JDK 17 (`C:\Program Files\Java\jdk-17`)
- Android Studio + SDK (`C:\Users\amari\AppData\Local\Android\Sdk`)
- Emulator: Pixel 8 API 34 (Android 14)

## โมเดล YOLO

- ต้นทาง: `D:\Coding\ppedetect_project\ppe_obj_detection\model\best_01062026_1057pm.pt` (YOLO26s)
- ONNX ที่ใช้ใน App: `D:\Coding\ppedetect_project\PpeDetectionApp\android\app\src\main\assets\best_01062026_1057pm.onnx`
- แปลงด้วย: `ultralytics export format=onnx imgsz=640 opset=19` (ผ่าน onnxslim)
- Runtime: app จะ copy จาก assets ไปไว้ที่ `DocumentDirectory` ตอนเปิดครั้งแรก
- Input: `[1, 3, 640, 640]` float32, normalized 0-1, CHW format
- **Preprocessing: letterbox** (resize รักษาสัดส่วนให้ด้านยาว = 640 + เติมขอบเทา 114/255 ให้ครบจตุรัส) — **ห้ามใช้ resize ยืด** เพราะโมเดลเทรนด้วย letterbox จะทำให้คะแนนคลาสตก. ตอน parse box ต้องถอด letterbox (หัก padLeft/padTop แล้วหารด้วย nw/nh) ก่อน map เป็นพิกัดจอ
- Input name: `images`
- Output name: `output0`, shape `[1, 8, 8400]` (4 bbox + 4 คลาส)
- Confidence threshold: 0.45 (ในโค้ด App.tsx), NMS IOU: 0.45

## Core Principles

1. **Never Guess** - อ่านโค้ดก่อนตอบ อย่าเดา
2. **Find Root Cause** - หาสาเหตุที่แท้จริง ไม่ใช่แค่แก้อาการ
3. **Minimize Changes** - ทำเฉพาะที่ขอ ไม่ over-engineer
4. การแก้ไข System.Environment ทุกครั้งให้ทำการแก้ผ่านหน้าจอ GUI (System Properties) เสมอ เพราะการแก้ผ่าน PowerShell ด้วย SetEnvironmentVariable จะเขียนทับ Path เดิมทั้งหมด ทำให้ node, git, ngrok และอื่นๆ หายไปจาก Path
5. ถ้าบอกให้ดู error จากรูปภาพ ให้เข้าไปดูในโฟลเดอร์ `D:\Coding\ppedetect_project\PpeDetectionApp\captureScreen`

## บุคลิกของผู้ช่วย

ผู้ช่วย AI ในโปรเจคนี้มีนิสัยร่าเริง เป็นกันเอง และสุภาพ พูดคุยด้วยความเป็นมิตร ใช้ภาษาที่เข้าใจง่าย และพร้อมช่วยเหลือเสมอด้วยความยินดี

## ผู้พัฒนา

ยะ & Claude
