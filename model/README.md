# 🛡️ Sentinel AI Inference Pipeline
> **Automated Vehicle Detection, ByteTrack Tracking, License Plate Localization & ANPR System**

The **Sentinel AI Inference Pipeline** is a real-time computer vision and ANPR (Automatic Number Plate Recognition) system designed for intelligent traffic surveillance, live camera streaming (RTSP/encrypted HLS), vehicle tracking, and automated plate recognition.

---

## 📂 Repository Contents

| File / Model Name | Description |
| :--- | :--- |
| 📓 [`SENTINEL_AI_INFERENCE_PIPELINE_(1) (1).ipynb`](file:///d:/Traing/JAVA/gov/model/SENTINEL_AI_INFERENCE_PIPELINE_%281%29%20%281%29.ipynb) | Full end-to-end interactive Jupyter Notebook containing all 42+ pipeline implementation steps. |
| 🚗 [`yolo11n.pt`](file:///d:/Traing/JAVA/gov/model/yolo11n.pt) | Primary **YOLOv11 Nano** model for detecting vehicles (Cars, Buses, Trucks, Motorcycles) and running ByteTrack object tracking. |
| 🏷️ [`license-plate-finetune-v1n.pt`](file:///d:/Traing/JAVA/gov/model/license-plate-finetune-v1n.pt) | Fine-tuned **YOLOv11** license plate localization model trained specifically to find plates inside cropped vehicle regions. |
| ⚡ [`infer.py`](file:///d:/Traing/JAVA/gov/model/infer.py) | Standalone command-line Python runner to process video files, RTSP streams, or live feeds without Jupyter. |

---

## 🏗️ Pipeline Architecture

```mermaid
graph TD
    A[Video Source / RTSP Stream / Encrypted HLS] --> B[Frame Extraction & PTS Timestamping]
    B --> C["Primary Detection: YOLOv11 (yolo11n.pt)"]
    C --> D[ByteTrack Tracking & VehicleMemory Voting]
    D --> E[Vehicle Bounding Box Crop]
    E --> F["Plate Localization: Fine-tuned YOLO (license-plate-finetune-v1n.pt)"]
    F --> G[Plate Preprocessing: Contrast / Scale / Threshold Variants]
    G --> H["OCR Recognition (EasyOCR / PaddleOCR)"]
    H --> I[Indian License Plate Regex & Validation Engine]
    I --> J[JSON Telemetry & Event Payload Generation]
```

### Key Technical Features

1. **Dual-Model Cascade Architecture**:
   - **Stage 1 (Vehicle Detection & Tracking)**: Uses `yolo11n.pt` with ByteTrack to assign unique persistent `track_id`s to vehicles. Smooths vehicle classification across frames via `VehicleMemory`.
   - **Stage 2 (Plate Localization)**: Uses `license-plate-finetune-v1n.pt` on cropped vehicle regions for maximum precision and computational efficiency.
2. **Stream Ingestion & Decryption**:
   - Native support for live RTSP camera feeds and AES-encrypted HLS stream playlists with frame presentation timestamps (PTS).
3. **Multi-Variant OCR Engine**:
   - Supports **EasyOCR** and **PaddleOCR**.
   - Generates image pre-processing variants (grayscale, cubic scaling, adaptive thresholding) to handle low-light or degraded plate images.
   - Includes validation filters tuned for standard Indian License Plate formats (e.g. `MH12AB1234`).
4. **Structured JSON Telemetry**:
   - Emits structured JSON events containing ISO timestamps, frame PTS, track IDs, vehicle classes, bounding box coordinates, recognized plate strings, and confidence metrics.

---

## 🛠️ Prerequisites & Installation

### 1. Python Version
Recommended: **Python 3.9 – 3.11**

### 2. Dependencies
Install the required packages using `pip`:

```bash
pip install ultralytics opencv-python numpy easyocr paddleocr paddlepaddle pycryptodome lap
```

---

## 🚀 Quick Start Guide

### Option A: Run via Standalone CLI Script (`infer.py`)

You can run inference directly on any video file or live stream using the provided [`infer.py`](file:///d:/Traing/JAVA/gov/model/infer.py) script.

#### Process a Local Video File:
```bash
python infer.py --source input_video.mp4 --show --output-json output_events.json
```

#### Process a Live RTSP Camera Feed:
```bash
python infer.py --source "rtsp://admin:pass@192.168.1.100:554/stream" --ocr-engine easyocr
```

#### CLI Arguments Reference:
| Parameter | Default | Description |
| :--- | :--- | :--- |
| `--source` | *Required* | Path to video file (`.mp4`, `.avi`) or RTSP stream URL. |
| `--vehicle-model` | `yolo11n.pt` | Path to vehicle detection weights. |
| `--plate-model` | `license-plate-finetune-v1n.pt` | Path to license plate localization weights. |
| `--ocr-engine` | `easyocr` | Engine choice: `easyocr`, `paddleocr`, or `none`. |
| `--imgsz` | `640` | Inference image size for vehicle detector. |
| `--conf` | `0.25` | Detection confidence threshold. |
| `--output-json` | `output_events.json` | Destination JSON file for event logging. |
| `--show` | `False` | Display interactive OpenCV visual preview window. |

---

### Option B: Interactive Jupyter Notebook

Open and execute [`SENTINEL_AI_INFERENCE_PIPELINE_(1) (1).ipynb`](file:///d:/Traing/JAVA/gov/model/SENTINEL_AI_INFERENCE_PIPELINE_%281%29%20%281%29.ipynb) in Jupyter Notebook or Google Colab:

```bash
jupyter notebook "SENTINEL_AI_INFERENCE_PIPELINE_(1) (1).ipynb"
```

The notebook contains step-by-step cells organized into:
- **Environment & Configuration** (Steps 1–3)
- **HLS Stream Handling & Decryption** (Steps 4–13)
- **Vehicle Detection & Tracking Setup** (Steps 14–16)
- **License Plate Detection & Crop Extraction** (Steps 17–19)
- **OCR Preprocessing & Text Validation** (Steps 20–37)
- **Live RTSP Stream & Sentinel Event Generation** (Steps 38–42)

---

## 📊 Sample Output JSON Payload

When running inference, Sentinel generates structured events in the following schema:

```json
[
  {
    "timestamp": "2026-09-02T09:20:00.123456+00:00",
    "pts_ms": 14200,
    "vehicle_count": 1,
    "detections": [
      {
        "track_id": 4,
        "vehicle_type": "car",
        "bbox": [420, 310, 890, 640],
        "plate": {
          "bbox": [580, 520, 710, 570],
          "confidence": 0.912,
          "text": "MH12AB1234",
          "ocr_confidence": 0.885
        }
      }
    ]
  }
]
```

---

## 🔒 License & Usage
Developed for **Sentinel AI Surveillance & ANPR Systems**.
