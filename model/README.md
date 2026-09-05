# 🛡️ Sentinel AI Inference Pipeline
> **Automated Vehicle Detection, ByteTrack Tracking, License Plate Localization & ANPR System**

The **Sentinel AI Inference Pipeline** is a real-time computer vision and ANPR (Automatic Number Plate Recognition) system designed for intelligent traffic surveillance, live camera streaming (RTSP/encrypted HLS), vehicle tracking, and automated plate recognition.

-## 📂 Repository Contents

All trained and fine-tuned AI neural network models are centralized in the [`weights/`](file:///d:/Traing/JAVA/gov/model/weights/) folder:

| File / Model Name | Description |
| :--- | :--- |
| 🛺 [`weights/uvh26_yolo11s.pt`](file:///d:/Traing/JAVA/gov/model/weights/uvh26_yolo11s.pt) | Primary **Indian Traffic YOLOv11-S** model (IISc Safe City CCTV) detecting 14 vehicle classes including **Auto-Rickshaws (3-wheelers)**, Two-wheelers, Cars, Trucks, Buses, Tempos, etc. |
| 🛵 [`weights/bd_traffic.pt`](file:///d:/Traing/JAVA/gov/model/weights/bd_traffic.pt) | Secondary fast traffic model specialized for **CNG Auto-Rickshaws**, Cycle Rickshaws, Bikes, Cars, Trucks, and Buses. |
| 🚗 [`weights/yolo11n.pt`](file:///d:/Traing/JAVA/gov/model/weights/yolo11n.pt) | Base COCO **YOLOv11 Nano** model providing general vehicle fallback verification. |
| 🏷️ [`weights/license-plate-finetune-v1n.pt`](file:///d:/Traing/JAVA/gov/model/weights/license-plate-finetune-v1n.pt) | Fine-tuned **YOLOv11** license plate localization model trained specifically to locate number plates across all vehicle types (rickshaws, bikes, cars, trucks). |
| ⚡ [`infer.py`](file:///d:/Traing/JAVA/gov/model/infer.py) | Standalone command-line Python runner to process video files, RTSP streams, or live feeds with full multi-model ByteTrack tracking & ANPR. |
| 🌐 [`server.py`](file:///d:/Traing/JAVA/gov/model/server.py) | FastAPI microservice serving live streams (`/api/v1/streams/{camera_id}/mjpeg`), frame inference (`/api/v1/infer/frame`), and job orchestration on port 8000. |
| 📓 [`PIPELINE2.ipynb`](file:///d:/Traing/JAVA/gov/model/PIPELINE2.ipynb) | Production Jupyter Notebook containing the full end-to-end Sentinel AI pipeline, model registry, live streaming, and watchlist alerts. |

---

## 🏗️ Supported Vehicle Classes

| Standard Class | Color Tag | Detected Types Included |
| :--- | :--- | :--- |
| **`auto_rickshaw`** | Amber / Gold | CNG 3-wheelers, Bajaj/Piaggio Auto-Rickshaws, Tuk-Tuks, E-Rickshaws |
| **`rickshaw`** | Yellow | Human-powered cycle rickshaws |
| **`motorcycle`** | Purple | Motorcycles, motorbikes, scooters, two-wheelers |
| **`car`** | Emerald Green | Hatchbacks, sedans, SUVs, MUVs, private cars |
| **`bus`** | Orange | Full-size passenger buses, school buses, mini-buses |
| **`truck`** | Sky Blue | Goods trucks, lorries, pickups, LCVs, mini-trucks |
| **`van`** | Teal | Tempo travellers, Omni/Eeco vans |
| **`bicycle`** | Spring Green | Bicycles, cycles |

```mermaid
graph TD
    A[Video Source / RTSP Stream / Encrypted HLS] --> B[Frame Extraction & PTS Timestamping]
    B --> C["Primary Detection: Indian Traffic YOLOv11s (weights/uvh26_yolo11s.pt)"]
    B --> D["Secondary Boost: Traffic / Rickshaw YOLO (weights/bd_traffic.pt)"]
    B --> E["Verification Layer: COCO YOLOv11n (weights/yolo11n.pt)"]
    C & D & E --> F[ByteTrack Tracking & VehicleMemory Voting]
    F --> G[Vehicle Bounding Box Crops]
    G --> H["Plate Localization: Fine-tuned YOLO (weights/license-plate-finetune-v1n.pt)"]
    H --> I[Plate Preprocessing: Contrast / Scale / Threshold Variants]
    I --> J["OCR Recognition (EasyOCR / PaddleOCR)"]
    J --> K[Indian License Plate Regex & Temporal Fusion Engine]
    K --> L[JSON Telemetry & Event Payload Generation]
```

### Key Technical Features

1. **Multi-Model Cascade Architecture**:
   - **Stage 1 (Primary Tracking)**: Uses `weights/uvh26_yolo11s.pt` with ByteTrack to track vehicles across 14 categories including Indian Auto-Rickshaws.
   - **Stage 2 (Specialized Boost)**: Uses `weights/bd_traffic.pt` for CNG auto-rickshaw and cycle-rickshaw enhancement.
   - **Stage 3 (General Fallback)**: Uses `weights/yolo11n.pt` to ensure zero missed standard COCO vehicle instances.
   - **Stage 4 (Plate Localization)**: Uses `weights/license-plate-finetune-v1n.pt` for high-precision plate bounding boxes.
2. **Stream Ingestion & Decryption**:
   - Native support for live RTSP camera feeds and AES-encrypted HLS stream playlists with frame presentation timestamps (PTS).
3. **Multi-Variant OCR Engine**:
   - Supports **EasyOCR** and **PaddleOCR**.
   - Generates image pre-processing variants (bicubic scaling, CLAHE, bilateral filter) to handle low-light or degraded plate images.
   - Includes validation filters tuned for standard Indian License Plate formats (e.g. `GJ01AB1234`).
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
| `--vehicle-model` | `weights/uvh26_yolo11s.pt` | Path to primary Indian traffic vehicle detection weights. |
| `--secondary-model` | `weights/bd_traffic.pt` | Path to secondary auto-rickshaw and traffic weights. |
| `--coco-model` | `weights/yolo11n.pt` | Path to COCO base vehicle fallback weights. |
| `--plate-model` | `weights/license-plate-finetune-v1n.pt` | Path to license plate localization weights. |
| `--ocr-engine` | `easyocr` | Engine choice: `easyocr`, `paddleocr`, or `none`. |
| `--imgsz` | `640` | Inference image size for vehicle detector. |
| `--conf` | `0.25` | Detection confidence threshold. |
| `--output-json` | `output_events.json` | Destination JSON file for event logging. |
| `--show` | `False` | Display interactive OpenCV visual preview window. |

---

### Option B: Interactive Jupyter Notebook

Open and execute [`PIPELINE2.ipynb`](file:///d:/Traing/JAVA/gov/model/PIPELINE2.ipynb) in Jupyter Notebook:

```bash
jupyter notebook PIPELINE2.ipynb
```

The notebook contains step-by-step production cells organized into:
- **Environment & Configuration** (Cells 1–4)
- **Sentinel AI Production Model Registry & Health Check** (Cells 5–6)
- **Sentinel Session, Auth & Dynamic Discovery** (Cells 7–17)
- **AI Model Status & Warm-Up** (Cells 18–25)
- **Plate Quality & Multi-Frame OCR Fusion** (Cells 26–36)
- **End-to-End Vehicle + Plate + OCR Pipeline** (Cell 37)
- **Sentinel AI Model API & Data Contract** (Cells 38–43)
- **Watchlist & Alert Engine** (Cells 44–47)
- **Cross-Camera Vehicle Journey Engine** (Cell 48)
- **Live RTSP Stream & Real-Time Smooth Visualizer** (Cells 49–56)

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
