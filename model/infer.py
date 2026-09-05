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


INDIAN_STATE_CODES = {
    "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DL", "DN", "GA", "GJ",
    "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
    "MZ", "NL", "OD", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP",
    "WB", "BH"
}

NOISE_WORDS = {
    "STOP", "EXIT", "TAXI", "BUS", "AUTO", "POLICE", "INDIA", "CAR",
    "SPEED", "SLOW", "GOV", "GOVT", "TMTART", "CNG", "PETROL", "DIESEL",
    "HERO", "HONDA", "SUZUKI", "TATA", "HYUNDAI", "MAHINDRA", "TOYOTA"
}


class VehicleMemory:
    """Tracks vehicle type consensus and best verified plate over multiple frames."""
    def __init__(self):
        self.history = {}
        self.plates = {}  # track_id -> {"text": str, "conf": float, "ocr_conf": float, "last_seen": float}

    def update(self, track_id, cls_name):
        if track_id not in self.history:
            self.history[track_id] = []
        self.history[track_id].append(cls_name)

    def get_vehicle_type(self, track_id):
        if track_id not in self.history or not self.history[track_id]:
            return "vehicle"
        from collections import Counter
        return Counter(self.history[track_id]).most_common(1)[0][0]

    def update_plate(self, track_id, plate_text, plate_conf, ocr_conf):
        if not plate_text or track_id == -1:
            return
        existing = self.plates.get(track_id)
        if not existing:
            self.plates[track_id] = {
                "text": plate_text,
                "confidence": plate_conf,
                "ocr_confidence": ocr_conf,
                "updated_at": time.time()
            }
        else:
            # Upgrade if new reading is longer or higher confidence
            if len(plate_text) > len(existing["text"]) or (len(plate_text) == len(existing["text"]) and ocr_conf > existing["ocr_confidence"]):
                self.plates[track_id] = {
                    "text": plate_text,
                    "confidence": max(plate_conf, existing["confidence"]),
                    "ocr_confidence": max(ocr_conf, existing["ocr_confidence"]),
                    "updated_at": time.time()
                }

    def get_best_plate(self, track_id):
        return self.plates.get(track_id)


def normalize_plate_text(text: str) -> str:
    """Clean and normalize license plate characters."""
    if not text:
        return ""
    # Remove non-alphanumeric characters and convert to uppercase
    clean = "".join([c for c in text if c.isalnum()]).upper()
    return clean


def is_valid_license_plate(text: str) -> bool:
    """Rigorous check to filter out random OCR noise (e.g. single letters 'J', 'E', 2-digits '04', '63', 'LN')."""
    if not text:
        return False
    clean = normalize_plate_text(text)
    
    # Real plates must be between 4 and 11 characters
    if len(clean) < 4 or len(clean) > 11:
        return False
    
    # License plates must contain digits (e.g. GJ01 or 1234)
    has_digit = any(c.isdigit() for c in clean)
    if not has_digit:
        return False

    # License plates must contain letters (e.g. state code GJ, MH or series AB)
    has_alpha = any(c.isalpha() for c in clean)
    if not has_alpha:
        return False

    # Reject known non-plate words/stickers
    if clean in NOISE_WORDS:
        return False

    return True


def is_plausible_indian_plate(text: str) -> bool:
    """Validate standard Indian license plate structure (e.g., GJ01AB1234 or MH12DE1433)."""
    clean = normalize_plate_text(text)
    if not is_valid_license_plate(clean):
        return False
    # Check if starts with a recognized Indian state code
    if clean[:2] in INDIAN_STATE_CODES:
        return True
    return False


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


from collections import defaultdict, Counter
import re


# ============================================================
# PIPELINE2: TEMPORAL PLATE EVIDENCE ENGINE
# ============================================================

class TemporalPlateFusion:
    """Consolidates multi-frame license plate observations to eliminate false positives."""
    def __init__(self, min_observations=2, min_confidence=0.35, max_history=20):
        self.min_observations = min_observations
        self.min_confidence = min_confidence
        self.max_history = max_history
        self.history = defaultdict(list)

    @staticmethod
    def normalize_text(text):
        if text is None:
            return None
        text = str(text).upper()
        text = re.sub(r"[^A-Z0-9]", "", text)
        return text if text else None

    def add_observation(self, track_id, text, confidence):
        if track_id is None or text is None:
            return None
        try:
            confidence = float(confidence)
        except Exception:
            return None
        if confidence < self.min_confidence:
            return None

        text = self.normalize_text(text)
        if text is None or not is_valid_license_plate(text):
            return None

        observation = {
            "text": text,
            "confidence": confidence,
            "timestamp": time.time()
        }
        self.history[int(track_id)].append(observation)
        self.history[int(track_id)] = self.history[int(track_id)][-self.max_history:]
        return self.get_reliable_plate(track_id)

    def get_reliable_plate(self, track_id):
        if track_id is None:
            return None
        observations = self.history.get(int(track_id), [])
        if not observations:
            return None

        counts = Counter(obs["text"] for obs in observations)
        best_text, count = counts.most_common(1)[0]

        # Require repeated observations OR very confident Indian plate
        if count < self.min_observations:
            high_conf = [
                obs for obs in observations
                if obs["confidence"] >= 0.65 and is_plausible_indian_plate(obs["text"])
            ]
            if high_conf:
                best_text = high_conf[-1]["text"]
            else:
                return None

        matching = [obs for obs in observations if obs["text"] == best_text]
        if not matching:
            return None

        confidence = sum(obs["confidence"] for obs in matching) / len(matching)
        return {
            "text": best_text,
            "confidence": round(confidence, 4)
        }

    def remove_track(self, track_id):
        if track_id is not None:
            self.history.pop(int(track_id), None)

    def clear(self):
        self.history.clear()


def get_box_center(box):
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def point_inside_box(point, box):
    px, py = point
    x1, y1, x2, y2 = box
    return x1 <= px <= x2 and y1 <= py <= y2


def find_vehicle_for_plate(plate_box, vehicle_boxes):
    """Associates a detected plate with the vehicle containing its center."""
    plate_center = get_box_center(plate_box)
    candidates = []
    for idx, vehicle in enumerate(vehicle_boxes):
        if point_inside_box(plate_center, vehicle["box"]):
            x1, y1, x2, y2 = vehicle["box"]
            area = max(0, x2 - x1) * max(0, y2 - y1)
            candidates.append((area, idx))
    if not candidates:
        return None
    candidates.sort()
    return candidates[0][1]


def prepare_plate_for_ocr(crop):
    """Pipeline2 enhanced plate preprocessing: 4x bicubic upscale + CLAHE + bilateral filter."""
    if crop is None or crop.size == 0:
        return None
    h, w = crop.shape[:2]
    if h < 10 or w < 24:
        return None
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    scale = 4 if w < 160 else 2
    enlarged = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(enlarged)
    denoised = cv2.bilateralFilter(enhanced, 5, 40, 40)
    return denoised


class SentinelPipeline:
    """Sentinel AI Pipeline2: Vehicle Tracking + Full-Frame Plate Detection + Temporal Fusion."""
    def __init__(self, vehicle_model_path, plate_model_path, ocr_engine="easyocr", imgsz=640, conf=0.25):
        print(f"[Sentinel AI Pipeline2] Loading Vehicle Model: {vehicle_model_path}")
        self.vehicle_model = YOLO(vehicle_model_path)
        
        print(f"[Sentinel AI Pipeline2] Loading Plate Model: {plate_model_path}")
        self.plate_model = YOLO(plate_model_path)
        
        self.imgsz = imgsz
        self.conf = conf
        self.ocr_engine_type = ocr_engine.lower()
        self.ocr_reader = None
        self.memory = VehicleMemory()
        self.fusion = TemporalPlateFusion(min_observations=2, min_confidence=0.35, max_history=20)
        
        self._init_ocr()

    def _init_ocr(self):
        if self.ocr_engine_type == "easyocr":
            if EASYOCR_AVAILABLE:
                print("[Sentinel AI Pipeline2] Initializing EasyOCR Reader (English)...")
                self.ocr_reader = easyocr.Reader(['en'], gpu=True)
            else:
                print("[Warning] EasyOCR requested but not installed.")
        elif self.ocr_engine_type == "paddleocr":
            if PADDLEOCR_AVAILABLE:
                print("[Sentinel AI Pipeline2] Initializing PaddleOCR Reader...")
                self.ocr_reader = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            else:
                print("[Warning] PaddleOCR requested but not installed.")

    def run_ocr(self, crop):
        if self.ocr_reader is None or crop is None or crop.size == 0:
            return None, 0.0

        # Step 1: Pipeline2 enhanced preprocessed crop
        prepared = prepare_plate_for_ocr(crop)
        if prepared is None:
            return None, 0.0

        candidates = []
        try:
            if self.ocr_engine_type == "easyocr" and EASYOCR_AVAILABLE:
                # Run OCR on enhanced image
                results = self.ocr_reader.readtext(prepared, detail=1, paragraph=False)
                if results:
                    filtered = [
                        r for r in results
                        if float(r[2]) >= 0.20 and len(normalize_plate_text(r[1])) > 0
                    ]
                    if filtered:
                        # Multi-line / multi-box plate assembly
                        filtered.sort(key=lambda r: (
                            int(np.mean([pt[1] for pt in r[0]]) / 18) * 18,
                            np.mean([pt[0] for pt in r[0]])
                        ))
                        combined_text = "".join(normalize_plate_text(r[1]) for r in filtered)
                        avg_conf = float(np.mean([r[2] for r in filtered]))

                        if is_valid_license_plate(combined_text) and avg_conf >= 0.30:
                            candidates.append({"text": combined_text, "confidence": avg_conf})

            elif self.ocr_engine_type == "paddleocr" and PADDLEOCR_AVAILABLE:
                results = self.ocr_reader.ocr(prepared, cls=True)
                if results and results[0]:
                    lines = [line for line in results[0] if float(line[1][1]) >= 0.25]
                    if lines:
                        combined = "".join(normalize_plate_text(l[1][0]) for l in lines)
                        avg_conf = float(np.mean([l[1][1] for l in lines]))
                        if is_valid_license_plate(combined) and avg_conf >= 0.30:
                            candidates.append({"text": combined, "confidence": avg_conf})

        except Exception:
            pass

        if not candidates:
            return None, 0.0

        # Pick best candidate with Indian state priority bonus
        best = max(
            candidates,
            key=lambda c: c["confidence"] + (0.35 if is_plausible_indian_plate(c["text"]) else 0.0)
        )
        return best["text"], round(best["confidence"], 3)

    def process_frame(self, frame, pts_ms=None):
        if pts_ms is None:
            pts_ms = int(time.time() * 1000)

        # 1. Pipeline2: Track Vehicles with YOLO & ByteTrack
        vehicle_results = self.vehicle_model.track(
            frame,
            imgsz=self.imgsz,
            conf=self.conf,
            persist=True,
            verbose=False
        )

        vehicle_boxes = []
        if vehicle_results and len(vehicle_results) > 0 and vehicle_results[0].boxes is not None:
            boxes = vehicle_results[0].boxes
            xyxy_list = boxes.xyxy.cpu().numpy().tolist()
            confs = boxes.conf.cpu().numpy().tolist()
            classes = boxes.cls.cpu().numpy().astype(int).tolist()
            track_ids = boxes.id.cpu().numpy().astype(int).tolist() if boxes.id is not None else [-1] * len(xyxy_list)

            for xyxy, conf, cls_id, tid in zip(xyxy_list, confs, classes, track_ids):
                cls_name = self.vehicle_model.names.get(cls_id, "vehicle")
                if tid != -1:
                    self.memory.update(tid, cls_name)
                    cls_name = self.memory.get_vehicle_type(tid)

                vehicle_boxes.append({
                    "box": list(map(int, xyxy)),
                    "confidence": float(conf),
                    "class_name": cls_name,
                    "track_id": tid
                })

        # 2. Pipeline2: Full-frame plate detection for maximum resolution
        plate_results = self.plate_model.predict(
            frame,
            imgsz=640,
            conf=0.20,
            verbose=False
        )

        detected_plates = []
        if plate_results and len(plate_results) > 0 and plate_results[0].boxes is not None:
            pboxes = plate_results[0].boxes
            pxyxy = pboxes.xyxy.cpu().numpy().tolist()
            pconfs = pboxes.conf.cpu().numpy().tolist()

            for pbox, pconf in zip(pxyxy, pconfs):
                px1, py1, px2, py2 = map(int, pbox)
                plate_crop = frame[max(0, py1):min(frame.shape[0], py2), max(0, px1):min(frame.shape[1], px2)]
                
                # Associated vehicle
                matched_veh_idx = find_vehicle_for_plate([px1, py1, px2, py2], vehicle_boxes)

                ocr_text, ocr_conf = self.run_ocr(plate_crop)

                detected_plates.append({
                    "bbox": [px1, py1, px2, py2],
                    "confidence": round(float(pconf), 3),
                    "matched_vehicle_idx": matched_veh_idx,
                    "ocr_text": ocr_text,
                    "ocr_confidence": ocr_conf
                })

        # 3. Pipeline2: Temporal Fusion & Assembly
        detections = []
        annotated_frame = frame.copy()

        for idx, vehicle in enumerate(vehicle_boxes):
            vx1, vy1, vx2, vy2 = vehicle["box"]
            track_id = vehicle["track_id"]
            cls_name = vehicle["class_name"]

            # Find plates matching this vehicle
            matching_plates = [p for p in detected_plates if p["matched_vehicle_idx"] == idx]

            plate_info = None
            if matching_plates:
                best_p = max(matching_plates, key=lambda p: p["confidence"])
                p_text = best_p["ocr_text"]
                p_conf = best_p["ocr_confidence"]

                # Feed into TemporalPlateFusion
                if p_text and track_id != -1:
                    fused = self.fusion.add_observation(track_id, p_text, p_conf)
                    if fused:
                        p_text = fused["text"]
                        p_conf = fused["confidence"]
                    else:
                        # Check existing reliable plate from memory
                        existing_fused = self.fusion.get_reliable_plate(track_id)
                        if existing_fused:
                            p_text = existing_fused["text"]
                            p_conf = existing_fused["confidence"]

                if p_text:
                    self.memory.update_plate(track_id, p_text, best_p["confidence"], p_conf)
                elif track_id != -1:
                    cached = self.memory.get_best_plate(track_id)
                    if cached:
                        p_text = cached["text"]
                        p_conf = cached["ocr_confidence"]

                plate_info = {
                    "bbox": best_p["bbox"],
                    "confidence": best_p["confidence"],
                    "text": p_text,
                    "ocr_confidence": p_conf
                }

                # Draw plate bounding box
                px1, py1, px2, py2 = best_p["bbox"]
                cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (0, 255, 0), 2)
                if p_text:
                    cv2.putText(annotated_frame, f"PLATE: {p_text}", (px1, max(0, py1 - 5)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 2)
            else:
                # Reuse cached plate from memory if tracked vehicle had a previous valid plate
                if track_id != -1:
                    cached = self.memory.get_best_plate(track_id)
                    if cached:
                        plate_info = {
                            "bbox": [vx1, vy1, vx1 + 100, vy1 + 30],
                            "confidence": cached["confidence"],
                            "text": cached["text"],
                            "ocr_confidence": cached["ocr_confidence"]
                        }

            # Draw vehicle bounding box
            cv2.rectangle(annotated_frame, (vx1, vy1), (vx2, vy2), (255, 0, 0), 2)
            veh_label = f"#{track_id} {cls_name}" if track_id != -1 else cls_name
            cv2.putText(annotated_frame, veh_label, (vx1, max(0, vy1 - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

            detections.append({
                "track_id": track_id,
                "vehicle_type": cls_name,
                "bbox": [vx1, vy1, vx2, vy2],
                "plate": plate_info
            })

        event_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pts_ms": pts_ms,
            "vehicle_count": len(detections),
            "detections": detections,
            "pipeline": "pipeline2"
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
