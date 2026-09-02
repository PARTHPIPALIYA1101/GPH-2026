"""
Sentinel AI Inference Pipeline - Standalone CLI Runner
Vehicle Detection + ByteTrack Tracking + License Plate Localization + ANPR OCR
"""

import os
import sys
import json
import time
import argparse
import cv2
import numpy as np
from datetime import datetime, timezone

# 1. Check & Import Ultralytics YOLO
try:
    from ultralytics import YOLO
except ImportError:
    sys.exit("Error: 'ultralytics' module not found. Run 'pip install ultralytics'")

# 2. Check OCR Engines
EASYOCR_AVAILABLE = False
PADDLEOCR_AVAILABLE = False

try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    pass

try:
    from paddleocr import PaddleOCR
    PADDLEOCR_AVAILABLE = True
except ImportError:
    pass


class VehicleMemory:
    """Tracks vehicle type consensus over multiple frame detections."""
    def __init__(self):
        self.history = {}

    def update(self, track_id, cls_name):
        if track_id not in self.history:
            self.history[track_id] = []
        self.history[track_id].append(cls_name)

    def get_vehicle_type(self, track_id):
        if track_id not in self.history or not self.history[track_id]:
            return "vehicle"
        # Return most common classification
        from collections import Counter
        return Counter(self.history[track_id]).most_common(1)[0][0]


def normalize_plate_text(text: str) -> str:
    """Clean and normalize license plate characters."""
    if not text:
        return ""
    # Remove non-alphanumeric characters and convert to uppercase
    clean = "".join([c for c in text if c.isalnum()]).upper()
    return clean


def is_plausible_indian_plate(text: str) -> bool:
    """Validate standard Indian license plate structure (e.g., MH12AB1234)."""
    text = normalize_plate_text(text)
    if len(text) < 6 or len(text) > 11:
        return False
    # Indian plates typically start with 2 state code letters
    if not text[:2].isalpha():
        return False
    return True


def preprocess_plate_crops(plate_crop):
    """Generate contrast/threshold variants for enhanced OCR reading."""
    if plate_crop is None or plate_crop.size == 0:
        return []
    
    variants = []
    # Original
    variants.append(("original", plate_crop))
    
    # Grayscale
    gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
    variants.append(("gray", cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)))
    
    # Scaled 2x + Adaptive Threshold
    resized = cv2.resize(gray, (0, 0), fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    thresh = cv2.adaptiveThreshold(
        resized, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    variants.append(("thresh", cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)))
    
    return variants


class SentinelPipeline:
    def __init__(self, vehicle_model_path, plate_model_path, ocr_engine="easyocr", imgsz=640, conf=0.25):
        print(f"[Sentinel AI] Loading Vehicle Model: {vehicle_model_path}")
        self.vehicle_model = YOLO(vehicle_model_path)
        
        print(f"[Sentinel AI] Loading Plate Model: {plate_model_path}")
        self.plate_model = YOLO(plate_model_path)
        
        self.imgsz = imgsz
        self.conf = conf
        self.ocr_engine_type = ocr_engine.lower()
        self.ocr_reader = None
        self.memory = VehicleMemory()
        
        self._init_ocr()

    def _init_ocr(self):
        if self.ocr_engine_type == "easyocr":
            if EASYOCR_AVAILABLE:
                print("[Sentinel AI] Initializing EasyOCR Reader (English)...")
                self.ocr_reader = easyocr.Reader(['en'], gpu=True)
            else:
                print("[Warning] EasyOCR requested but not installed.")
        elif self.ocr_engine_type == "paddleocr":
            if PADDLEOCR_AVAILABLE:
                print("[Sentinel AI] Initializing PaddleOCR Reader...")
                self.ocr_reader = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            else:
                print("[Warning] PaddleOCR requested but not installed.")

    def run_ocr(self, crop):
        if self.ocr_reader is None:
            return None, 0.0

        variants = preprocess_plate_crops(crop)
        best_text = ""
        best_conf = 0.0

        for var_name, var_img in variants:
            text, conf = "", 0.0
            try:
                if self.ocr_engine_type == "easyocr" and EASYOCR_AVAILABLE:
                    results = self.ocr_reader.readtext(var_img)
                    for _, res_text, res_conf in results:
                        if res_conf > conf:
                            text = res_text
                            conf = res_conf
                elif self.ocr_engine_type == "paddleocr" and PADDLEOCR_AVAILABLE:
                    results = self.ocr_reader.ocr(var_img, cls=True)
                    if results and results[0]:
                        for line in results[0]:
                            res_text = line[1][0]
                            res_conf = line[1][1]
                            if res_conf > conf:
                                text = res_text
                                conf = res_conf
            except Exception as e:
                continue

            clean_text = normalize_plate_text(text)
            if clean_text:
                score_boost = 0.2 if is_plausible_indian_plate(clean_text) else 0.0
                adjusted_conf = conf + score_boost
                if adjusted_conf > best_conf:
                    best_text = clean_text
                    best_conf = conf

        return (best_text, best_conf) if best_text else (None, 0.0)

    def process_frame(self, frame, pts_ms=None):
        if pts_ms is None:
            pts_ms = int(time.time() * 1000)

        # 1. Track Vehicles with YOLO & ByteTrack
        results = self.vehicle_model.track(
            frame,
            imgsz=self.imgsz,
            conf=self.conf,
            persist=True,
            verbose=False
        )

        detections = []
        annotated_frame = frame.copy()

        if results and len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes
            for box in boxes:
                xyxy = box.xyxy[0].cpu().numpy().tolist()
                track_id = int(box.id[0]) if box.id is not None else -1
                cls_id = int(box.cls[0])
                cls_name = self.vehicle_model.names.get(cls_id, "vehicle")

                if track_id != -1:
                    self.memory.update(track_id, cls_name)
                    cls_name = self.memory.get_vehicle_type(track_id)

                x1, y1, x2, y2 = map(int, xyxy)
                vehicle_crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]

                plate_info = None

                # 2. Detect Plate within Vehicle Crop
                if vehicle_crop.size > 0:
                    plate_results = self.plate_model(
                        vehicle_crop,
                        imgsz=320,
                        conf=0.25,
                        verbose=False
                    )

                    if plate_results and len(plate_results) > 0 and plate_results[0].boxes is not None:
                        p_boxes = plate_results[0].boxes
                        if len(p_boxes) > 0:
                            best_p_box = max(p_boxes, key=lambda b: float(b.conf[0]))
                            px1, py1, px2, py2 = map(int, best_p_box.xyxy[0].cpu().numpy().tolist())
                            p_conf = float(best_p_box.conf[0])

                            plate_crop = vehicle_crop[max(0, py1):min(vehicle_crop.shape[0], py2),
                                                      max(0, px1):min(vehicle_crop.shape[1], px2)]

                            # Map crop bbox to original frame coordinates
                            abs_px1, abs_py1 = x1 + px1, y1 + py1
                            abs_px2, abs_py2 = x1 + px2, y1 + py2

                            # 3. OCR Recognition
                            plate_text, ocr_conf = self.run_ocr(plate_crop)

                            plate_info = {
                                "bbox": [abs_px1, abs_py1, abs_px2, abs_py2],
                                "confidence": round(p_conf, 3),
                                "text": plate_text,
                                "ocr_confidence": round(ocr_conf, 3)
                            }

                            # Draw plate box
                            cv2.rectangle(annotated_frame, (abs_px1, abs_py1), (abs_px2, abs_py2), (0, 255, 0), 2)
                            label_str = f"PLATE: {plate_text}" if plate_text else "PLATE"
                            cv2.putText(annotated_frame, label_str, (abs_px1, max(0, abs_py1 - 5)),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                # Draw vehicle box
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                veh_label = f"#{track_id} {cls_name}" if track_id != -1 else cls_name
                cv2.putText(annotated_frame, veh_label, (x1, max(0, y1 - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

                detections.append({
                    "track_id": track_id,
                    "vehicle_type": cls_name,
                    "bbox": [x1, y1, x2, y2],
                    "plate": plate_info
                })

        event_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pts_ms": pts_ms,
            "vehicle_count": len(detections),
            "detections": detections
        }

        return annotated_frame, event_payload


def main():
    parser = argparse.ArgumentParser(description="Sentinel AI Inference Pipeline - Vehicle & ANPR")
    parser.add_argument("--source", type=str, required=True, help="Path to video file or RTSP stream URL")
    parser.add_argument("--vehicle-model", type=str, default="yolo11n.pt", help="Vehicle YOLO model path")
    parser.add_argument("--plate-model", type=str, default="license-plate-finetune-v1n.pt", help="Plate YOLO model path")
    parser.add_argument("--ocr-engine", type=str, choices=["easyocr", "paddleocr", "none"], default="easyocr", help="OCR Backend")
    parser.add_argument("--imgsz", type=int, default=640, help="YOLO inference image size")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO confidence threshold")
    parser.add_argument("--output-json", type=str, default="output_events.json", help="Path to output JSON results")
    parser.add_argument("--show", action="store_true", help="Display video stream output window")
    args = parser.parse_args()

    pipeline = SentinelPipeline(
        vehicle_model_path=args.vehicle_model,
        plate_model_path=args.plate_model,
        ocr_engine=args.ocr_engine,
        imgsz=args.imgsz,
        conf=args.conf
    )

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        sys.exit(f"Error: Could not open video source '{args.source}'")

    print(f"[Sentinel AI] Pipeline active. Processing stream from '{args.source}'...")
    events = []

    try:
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_idx += 1
            pts_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC))

            annotated_frame, event = pipeline.process_frame(frame, pts_ms=pts_ms)
            events.append(event)

            if args.show:
                cv2.imshow("Sentinel AI Inference Pipeline", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

            if frame_idx % 30 == 0:
                print(f"Processed {frame_idx} frames... (Vehicles in last frame: {event['vehicle_count']})")

    finally:
        cap.release()
        if args.show:
            cv2.destroyAllWindows()

        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
        print(f"[Sentinel AI] Done! Results saved to '{args.output_json}'")


if __name__ == "__main__":
    main()
