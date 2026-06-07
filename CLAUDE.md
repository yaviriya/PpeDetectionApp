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

## ผลเทสต์ FPS (วัดบน S23 Ultra, 4 คลาส + letterbox)

| โมเดล | FPS | inference | ขนาด onnx | สรุป |
|-------|-----|-----------|-----------|------|
| YOLO26s | ~3.5 | ~270ms | 36.4MB | ช้า เริ่มกระตุก |
| YOLOv8s แท้ (`bestv8s`) | ~3.3 | ~300ms | 42.7MB | **ไม่เร็วกว่า** YOLO26s (s แท้ใหญ่) |
| **YOLOv8n (`bestv8n`)** | **~8.5** | **117ms** | 11.7MB | **เร็วสุด ✅ ใช้ตัวนี้** |
| `best_22032026` (เก่า) | ~10 | ~95ms | 12.2MB | จริงๆ คือ **nano** (เลยเร็ว ไม่ใช่ s) |

→ สรุป: **ความเร็วมาจากขนาดโมเดล (nano) ไม่ใช่ตระกูล** — `bestv8n_07062026` (4 คลาส, nano) คือโมเดลหลักตอนนี้

## ฟีเจอร์แจ้งเตือน Telegram (ทำแล้ว)

- เจอ `NO-Hardhat` หรือ `Fall-Detected` ต่อเนื่อง 0.8 วิ → ส่ง alert เข้ากลุ่ม Telegram (debounce + cooldown 30 วิ)
- โหมด **"เฝ้าโซนกรวย"** (ปุ่ม toggle): เปิดแล้วถ้า `Safety-Cone` หาย >5 วิ → alert (scenario โซนที่บังคับต้องมีกรวย)
- ส่งผ่าน Bot API `sendPhoto` (อัปไฟล์ตรง ไม่ต้อง host) — **token + chat_id ฝังในแอป (เฟส 1)**
- ตอนนี้ส่ง **รูปดิบ** (ยังไม่มีกรอบในรูป — ดู "สิ่งที่ยังต้องทำ")

## สิ่งที่ยังต้องทำ

- [ ] **ปรับรูปแบบข้อความ alert (caption) ของ Telegram** — แก้ที่ตัวแปร caption ใน `checkAlerts` (App.tsx). รูปแบบที่ต้องการ:
  - บรรทัดแรก (ใต้รูป): หัวข้อ **`ระบบตรวจจับการสวมใส่ PPE`**
  - บรรทัดถัดมา: เหตุการณ์ที่เจอ (เช่น `⚠️ พบ NO-Hardhat`)
  - **วันที่ เป็น พ.ศ.** เช่น `7/6/2569` — Gregorian +543 หรือ `toLocaleDateString('th-TH-u-ca-buddhist')`
  - **เวลา** `HH:MM:SS`
  - **สถานที่ (location)** — ดึง GPS เครื่อง → พิกัด (lat,lng) + reverse geocode เป็นชื่อ (หมู่บ้าน/ตำบล/อำเภอ/จังหวัด)
    - ต้องใช้ lib location (`@react-native-community/geolocation` หรือ `react-native-get-location`) + permission `ACCESS_FINE_LOCATION` (build ใหม่)
    - reverse geocode: Google Maps Geocoding API (ต้องมี API key + อาจมีค่าใช้จ่าย) หรือ Nominatim/OSM (ฟรี แต่ rate-limit)
    - caveat: GPS ในอาคารอาจไม่แม่น, ดึงครั้งแรกช้า → ควร cache พิกัดล่าสุด, จัดการกรณีไม่มีสัญญาณ
  - ตัวอย่าง caption เป้าหมาย:
    ```
    ระบบตรวจจับการสวมใส่ PPE
    ⚠️ พบคนไม่สวมหมวกนิรภัย (NO-Hardhat)
    📅 วันที่: 7/6/2569
    🕐 เวลา: 17:21:02
    📍 สถานที่: บ้าน.. ต.. อ.. จ.. (13.7563, 100.5018)
    ```
- [ ] **วาดกรอบลงในรูป alert** (ทุกคลาสเหมือนในแอป) — เคยลอง `react-native-view-shot` แต่ **capture บน UI thread + v8n 10 FPS = แอปค้าง** → ถอนออกแล้ว. ครั้งหน้าใช้ **Skia headless** (วาดบน offscreen surface ไม่บล็อก UI thread, แสงเป๊ะ, ไม่มีแฟลช) แลกกับ RAM + build ใหม่
- [ ] **แก้รูป alert มืด** — `takeSnapshot()` ได้ภาพมืดกว่า live preview (จอผ่าน auto-exposure แต่ snapshot ดิบกว่า) → ใช้ `takePhoto()` แทน (exposure ถูก) แต่ต้อง map พิกัดกรอบใหม่ (มิติต่างจาก snapshot)
- [ ] **ย้าย token Telegram ไป backend** (เฟส 2) — ตอนนี้ฝังในแอป ถ้าแจก APK ให้คนอื่น token หลุด. ทำ relay บน GCP Cloud Run (Python LINE/Telegram SDK) + อาจรองรับ LINE OA ด้วย
- [ ] ทำเป็นไฟล์ APK (ตอนนี้รันผ่าน USB/Metro)
- [ ] ลด false positive (หมวกแดงโดนเดาเป็น Safety-Cone บางเฟรม)

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
