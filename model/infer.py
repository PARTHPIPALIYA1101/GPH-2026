"""
Sentinel AI Inference Pipeline - Multi-Vehicle Detection, Tracking & License Plate ANPR
Supports: Auto-Rickshaws, Rickshaws, Two-Wheelers/Motorcycles, Cars, Trucks, Buses, Tempos/Vans
"""

import os
import sys
import json
import time
import argparse
import re
from datetime import datetime, timezone
from collections import defaultdict, Counter
from typing import Dict, Any, Optional, Tuple, List

import cv2
import numpy as np

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
    "HERO", "HONDA", "SUZUKI", "TATA", "HYUNDAI", "MAHINDRA", "TOYOTA",
    "BAJAJ", "TVS", "YAMAHA", "ROYAL", "ENFIELD", "PIAGGIO", "ATUL"
}

# Standardized Vehicle Categories & Visual Display Colors (BGR)
CLASS_COLOR_MAP = {
    "auto_rickshaw": (0, 200, 255),    # Vibrant Amber / Gold
    "rickshaw":      (255, 200, 0),    # Yellow
    "motorcycle":    (255, 50, 180),   # Purple / Pink
    "car":           (50, 220, 50),    # Emerald Green
    "bus":           (0, 140, 255),    # Orange
    "truck":         (255, 120, 30),   # Sky Blue
    "van":           (180, 200, 40),   # Teal
    "bicycle":       (0, 255, 128),    # Spring Green
    "vehicle":       (200, 200, 200)   # Light Gray
}


def normalize_class_name(raw_name: str) -> str:
    """Map raw model detection class to standardized vehicle ontology."""
    if not raw_name:
        return "vehicle"
    name = str(raw_name).strip().lower().replace("_", "-").replace(" ", "-")

    if name in ("three-wheeler", "cng", "auto-rickshaw", "autorickshaw", "tuk-tuk", "auto"):
        return "auto_rickshaw"
    if name in ("rickshaw", "cycle-rickshaw"):
        return "rickshaw"
    if name in ("two-wheeler", "bike", "motorcycle", "scooter"):
        return "motorcycle"
    if name in ("hatchback", "sedan", "suv", "muv", "car"):
        return "car"
    if name in ("bus", "mini-bus"):
        return "bus"
    if name in ("truck", "lcv", "mini-truck"):
        return "truck"
    if name in ("tempo-traveller", "tempo", "van"):
        return "van"
    if name in ("bicycle", "cycle"):
        return "bicycle"

    return "vehicle"


class VehicleMemory:
    """Tracks vehicle type consensus and best verified plate over multiple frames."""
    def __init__(self):
        self.history = {}
        self.plates = {}

    def update(self, track_id: int, cls_name: str):
        if track_id not in self.history:
            self.history[track_id] = []
        self.history[track_id].append(cls_name)

    def get_vehicle_type(self, track_id: int) -> str:
        if track_id not in self.history or not self.history[track_id]:
            return "vehicle"
        return Counter(self.history[track_id]).most_common(1)[0][0]

    def update_plate(self, track_id: int, plate_text: str, plate_conf: float, ocr_conf: float):
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
            if len(plate_text) > len(existing["text"]) or (len(plate_text) == len(existing["text"]) and ocr_conf > existing["ocr_confidence"]):
                self.plates[track_id] = {
                    "text": plate_text,
                    "confidence": max(plate_conf, existing["confidence"]),
                    "ocr_confidence": max(ocr_conf, existing["ocr_confidence"]),
                    "updated_at": time.time()
                }

    def get_best_plate(self, track_id: int) -> Optional[Dict[str, Any]]:
        return self.plates.get(track_id)


def normalize_plate_text(text: str) -> str:
    """Clean and normalize license plate characters."""
    if not text:
        return ""
    return "".join([c for c in str(text) if c.isalnum()]).upper()


def is_valid_license_plate(text: str) -> bool:
    """Filter out random OCR noise."""
    if not text:
        return False
    clean = normalize_plate_text(text)
    if len(clean) < 4 or len(clean) > 11:
        return False
    has_digit = any(c.isdigit() for c in clean)
    if not has_digit:
        return False
    has_alpha = any(c.isalpha() for c in clean)
    if not has_alpha:
        return False
    if clean in NOISE_WORDS:
        return False
    return True


def is_plausible_indian_plate(text: str) -> bool:
    """Validate standard Indian license plate structure (e.g., GJ01AB1234)."""
    clean = normalize_plate_text(text)
    if not is_valid_license_plate(clean):
        return False
    if clean[:2] in INDIAN_STATE_CODES:
        return True
    return False


def prepare_plate_for_ocr(crop: np.ndarray) -> Optional[np.ndarray]:
    """Enhanced plate preprocessing: bicubic upscale + CLAHE + bilateral filter."""
    if crop is None or crop.size == 0:
        return None
    h, w = crop.shape[:2]
    if h < 10 or w < 20:
        return None
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    scale = 4 if w < 160 else 2
    enlarged = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(enlarged)
    denoised = cv2.bilateralFilter(enhanced, 5, 40, 40)
    return denoised


class TemporalPlateFusion:
    """Consolidates multi-frame license plate observations to eliminate false positives."""
    def __init__(self, min_observations: int = 2, min_confidence: float = 0.35, max_history: int = 20):
        self.min_observations = min_observations
        self.min_confidence = min_confidence
        self.max_history = max_history
        self.history = defaultdict(list)

    def add_observation(self, track_id: int, text: str, confidence: float) -> Optional[Dict[str, Any]]:
        if track_id is None or text is None:
            return None
        try:
            confidence = float(confidence)
        except Exception:
            return None
        if confidence < self.min_confidence:
            return None

        clean_text = normalize_plate_text(text)
        if not is_valid_license_plate(clean_text):
            return None

        observation = {
            "text": clean_text,
            "confidence": confidence,
            "timestamp": time.time()
        }
        self.history[int(track_id)].append(observation)
        self.history[int(track_id)] = self.history[int(track_id)][-self.max_history:]
        return self.get_reliable_plate(track_id)

    def get_reliable_plate(self, track_id: int) -> Optional[Dict[str, Any]]:
        if track_id is None:
            return None
        observations = self.history.get(int(track_id), [])
        if not observations:
            return None

        counts = Counter(obs["text"] for obs in observations)
        best_text, count = counts.most_common(1)[0]

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


def get_box_center(box: List[int]) -> Tuple[float, float]:
    x1, y1, x2, y2 = box
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def point_inside_box(point: Tuple[float, float], box: List[int]) -> bool:
    px, py = point
    x1, y1, x2, y2 = box
    return x1 <= px <= x2 and y1 <= py <= y2


def find_vehicle_for_plate(plate_box: List[int], vehicle_boxes: List[Dict[str, Any]]) -> Optional[int]:
    """Associates a detected plate with the vehicle containing its center or highest overlap."""
    plate_center = get_box_center(plate_box)
    candidates = []
    for idx, vehicle in enumerate(vehicle_boxes):
        vx1, vy1, vx2, vy2 = vehicle["box"]
        if point_inside_box(plate_center, vehicle["box"]):
            area = max(0, vx2 - vx1) * max(0, vy2 - vy1)
            candidates.append((area, idx))
        else:
            px1, py1, px2, py2 = plate_box
            ix1 = max(px1, vx1)
            iy1 = max(py1, vy1)
            ix2 = min(px2, vx2)
            iy2 = min(py2, vy2)
            if ix2 > ix1 and iy2 > iy1:
                inter_area = (ix2 - ix1) * (iy2 - iy1)
                plate_area = max(1, (px2 - px1) * (py2 - py1))
                if inter_area / plate_area > 0.4:
                    candidates.append((max(0, vx2 - vx1) * max(0, vy2 - vy1), idx))

    if not candidates:
        return None
    candidates.sort()
    return candidates[0][1]


class SentinelPipeline:
    """Sentinel AI Multi-Vehicle Pipeline: Auto-Rickshaws, Bikes, Cars, Trucks, Buses + Plate Localization + ANPR."""
    def __init__(
        self,
        vehicle_model_path: str = "weights/uvh26_yolo11s.pt",
        plate_model_path: str = "weights/license-plate-finetune-v1n.pt",
        ocr_engine: str = "easyocr",
        imgsz: int = 640,
        conf: float = 0.25,
        secondary_model_path: Optional[str] = "weights/bd_traffic.pt",
        coco_model_path: Optional[str] = "weights/yolo11n.pt"
    ):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        def resolve_model_path(path: Optional[str], default_filename: str = "") -> Optional[str]:
            if not path:
                return None
            if os.path.isabs(path) and os.path.exists(path):
                return path
            # Try path as given relative to base_dir
            candidate = os.path.join(base_dir, path)
            if os.path.exists(candidate):
                return candidate
            # Try inside weights folder
            weights_candidate = os.path.join(base_dir, "weights", os.path.basename(path))
            if os.path.exists(weights_candidate):
                return weights_candidate
            if default_filename:
                fallback = os.path.join(base_dir, "weights", default_filename)
                if os.path.exists(fallback):
                    return fallback
            return candidate

        vehicle_model_path = resolve_model_path(vehicle_model_path, "uvh26_yolo11s.pt")
        plate_model_path = resolve_model_path(plate_model_path, "license-plate-finetune-v1n.pt")
        secondary_model_path = resolve_model_path(secondary_model_path, "bd_traffic.pt")
        coco_model_path = resolve_model_path(coco_model_path, "yolo11n.pt")

        print(f"[Sentinel Pipeline] Loading Primary Vehicle Model: {vehicle_model_path}")
        self.vehicle_model = YOLO(vehicle_model_path)

        self.secondary_model = None
        if secondary_model_path and os.path.exists(secondary_model_path):
            print(f"[Sentinel Pipeline] Loading Secondary Traffic Model: {secondary_model_path}")
            self.secondary_model = YOLO(secondary_model_path)

        self.coco_model = None
        if coco_model_path and os.path.exists(coco_model_path):
            print(f"[Sentinel Pipeline] Loading COCO Base Model: {coco_model_path}")
            self.coco_model = YOLO(coco_model_path)

        print(f"[Sentinel Pipeline] Loading Plate Model: {plate_model_path}")
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
                print("[Sentinel Pipeline] Initializing EasyOCR Reader (English)...")
                self.ocr_reader = easyocr.Reader(['en'], gpu=True)
            else:
                print("[Warning] EasyOCR requested but not installed.")
        elif self.ocr_engine_type == "paddleocr":
            if PADDLEOCR_AVAILABLE:
                print("[Sentinel Pipeline] Initializing PaddleOCR Reader...")
                self.ocr_reader = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            else:
                print("[Warning] PaddleOCR requested but not installed.")

    def run_ocr(self, crop: np.ndarray) -> Tuple[Optional[str], float]:
        if self.ocr_reader is None or crop is None or crop.size == 0:
            return None, 0.0

        prepared = prepare_plate_for_ocr(crop)
        if prepared is None:
            return None, 0.0

        candidates = []
        try:
            if self.ocr_engine_type == "easyocr" and EASYOCR_AVAILABLE:
                results = self.ocr_reader.readtext(prepared, detail=1, paragraph=False)
                if results:
                    filtered = [
                        r for r in results
                        if float(r[2]) >= 0.20 and len(normalize_plate_text(r[1])) > 0
                    ]
                    if filtered:
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

        best = max(
            candidates,
            key=lambda c: c["confidence"] + (0.35 if is_plausible_indian_plate(c["text"]) else 0.0)
        )
        return best["text"], round(best["confidence"], 3)

    def process_frame(self, frame: np.ndarray, pts_ms: Optional[int] = None) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Processes a single video frame. Returns (annotated_frame, event_payload)."""
        if pts_ms is None:
            pts_ms = int(time.time() * 1000)

        # 1. Primary Vehicle Tracking (ByteTrack)
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
                raw_cls = self.vehicle_model.names.get(cls_id, "vehicle")
                normalized_cls = normalize_class_name(raw_cls)
                if tid != -1:
                    self.memory.update(tid, normalized_cls)
                    normalized_cls = self.memory.get_vehicle_type(tid)

                vehicle_boxes.append({
                    "box": list(map(int, xyxy)),
                    "confidence": round(float(conf), 3),
                    "class_name": normalized_cls,
                    "raw_class": raw_cls,
                    "track_id": tid
                })

        # 2. Secondary model boost for specialized rickshaw detection
        if self.secondary_model is not None:
            sec_res = self.secondary_model.predict(frame, imgsz=self.imgsz, conf=self.conf, verbose=False)
            if sec_res and len(sec_res) > 0 and sec_res[0].boxes is not None:
                sboxes = sec_res[0].boxes
                for sxyxy, sconf, scls_id in zip(sboxes.xyxy.cpu().numpy().tolist(), sboxes.conf.cpu().numpy().tolist(), sboxes.cls.cpu().numpy().astype(int).tolist()):
                    sname = self.secondary_model.names.get(scls_id, "")
                    s_norm = normalize_class_name(sname)
                    if s_norm in ("auto_rickshaw", "rickshaw"):
                        sb = list(map(int, sxyxy))
                        overlap = False
                        for v in vehicle_boxes:
                            vx1, vy1, vx2, vy2 = v["box"]
                            ix1, iy1 = max(sb[0], vx1), max(sb[1], vy1)
                            ix2, iy2 = min(sb[2], vx2), min(sb[3], vy2)
                            if ix2 > ix1 and iy2 > iy1:
                                inter = (ix2 - ix1) * (iy2 - iy1)
                                union = (sb[2]-sb[0])*(sb[3]-sb[1]) + (vx2-vx1)*(vy2-vy1) - inter
                                if inter / max(1, union) > 0.4:
                                    overlap = True
                                    if v["class_name"] in ("car", "truck", "vehicle"):
                                        v["class_name"] = s_norm
                                    break
                        if not overlap and float(sconf) >= 0.35:
                            vehicle_boxes.append({
                                "box": sb,
                                "confidence": round(float(sconf), 3),
                                "class_name": s_norm,
                                "raw_class": sname,
                                "track_id": -1
                            })

        # 3. Base COCO model verification / fallback (captures standard vehicles missed by domain models)
        if self.coco_model is not None:
            coco_res = self.coco_model.predict(frame, imgsz=self.imgsz, conf=self.conf, verbose=False)
            if coco_res and len(coco_res) > 0 and coco_res[0].boxes is not None:
                cboxes = coco_res[0].boxes
                for cxyxy, cconf, ccls_id in zip(cboxes.xyxy.cpu().numpy().tolist(), cboxes.conf.cpu().numpy().tolist(), cboxes.cls.cpu().numpy().astype(int).tolist()):
                    cname = self.coco_model.names.get(ccls_id, "")
                    c_norm = normalize_class_name(cname)
                    if c_norm in ("car", "motorcycle", "bus", "truck", "van", "bicycle"):
                        cb = list(map(int, cxyxy))
                        overlap = False
                        for v in vehicle_boxes:
                            vx1, vy1, vx2, vy2 = v["box"]
                            ix1, iy1 = max(cb[0], vx1), max(cb[1], vy1)
                            ix2, iy2 = min(cb[2], vx2), min(cb[3], vy2)
                            if ix2 > ix1 and iy2 > iy1:
                                inter = (ix2 - ix1) * (iy2 - iy1)
                                union = (cb[2]-cb[0])*(cb[3]-cb[1]) + (vx2-vx1)*(vy2-vy1) - inter
                                if inter / max(1, union) > 0.35:
                                    overlap = True
                                    break
                        if not overlap and float(cconf) >= 0.35:
                            vehicle_boxes.append({
                                "box": cb,
                                "confidence": round(float(cconf), 3),
                                "class_name": c_norm,
                                "raw_class": cname,
                                "track_id": -1
                            })

        # 4. Plate Detection (Full-Frame)
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
                matched_veh_idx = find_vehicle_for_plate([px1, py1, px2, py2], vehicle_boxes)
                ocr_text, ocr_conf = self.run_ocr(plate_crop)

                detected_plates.append({
                    "bbox": [px1, py1, px2, py2],
                    "confidence": round(float(pconf), 3),
                    "matched_vehicle_idx": matched_veh_idx,
                    "ocr_text": ocr_text,
                    "ocr_confidence": ocr_conf
                })

        # 5. Association & Visual Rendering
        detections = []
        annotated_frame = frame.copy()

        for idx, vehicle in enumerate(vehicle_boxes):
            vx1, vy1, vx2, vy2 = vehicle["box"]
            track_id = vehicle["track_id"]
            cls_name = vehicle["class_name"]
            veh_conf = vehicle["confidence"]

            v_plates = [p for p in detected_plates if p["matched_vehicle_idx"] == idx]
            assigned_plate = None

            if v_plates:
                best_p = max(v_plates, key=lambda p: (1 if p["ocr_text"] else 0, p["confidence"]))
                if best_p["ocr_text"] and track_id != -1:
                    self.memory.update_plate(track_id, best_p["ocr_text"], best_p["confidence"], best_p["ocr_confidence"])
                    self.fusion.add_observation(track_id, best_p["ocr_text"], best_p["ocr_confidence"])

                assigned_plate = {
                    "bbox": best_p["bbox"],
                    "confidence": best_p["confidence"],
                    "text": best_p["ocr_text"],
                    "ocr_confidence": best_p["ocr_confidence"]
                }
            else:
                mem_p = self.memory.get_best_plate(track_id) if track_id != -1 else None
                if mem_p:
                    assigned_plate = {
                        "bbox": None,
                        "confidence": mem_p["confidence"],
                        "text": mem_p["text"],
                        "ocr_confidence": mem_p["ocr_confidence"]
                    }

            if track_id != -1:
                fused = self.fusion.get_reliable_plate(track_id)
                if fused and assigned_plate:
                    assigned_plate["text"] = fused["text"]
                    assigned_plate["ocr_confidence"] = fused["confidence"]

            detections.append({
                "track_id": track_id,
                "vehicle_type": cls_name,
                "confidence": veh_conf,
                "bbox": [vx1, vy1, vx2, vy2],
                "plate": assigned_plate
            })

            # Visual Rendering
            color = CLASS_COLOR_MAP.get(cls_name, CLASS_COLOR_MAP["vehicle"])
            cv2.rectangle(annotated_frame, (vx1, vy1), (vx2, vy2), color, 2)

            label_parts = []
            if track_id != -1:
                label_parts.append(f"#{track_id}")
            label_parts.append(cls_name.replace("_", " ").title())
            label_parts.append(f"{int(veh_conf * 100)}%")

            if assigned_plate and assigned_plate["text"]:
                label_parts.append(f"[{assigned_plate['text']}]")

            label = " ".join(label_parts)
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(annotated_frame, (vx1, max(0, vy1 - lh - 6)), (vx1 + lw + 6, vy1), color, -1)
            cv2.putText(annotated_frame, label, (vx1 + 3, vy1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

        # Draw independent plates (plates not attached to vehicle boxes)
        for p in detected_plates:
            if p["matched_vehicle_idx"] is None:
                px1, py1, px2, py2 = p["bbox"]
                cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (0, 255, 255), 2)
                p_text = f"PLATE {p['ocr_text']}" if p["ocr_text"] else "PLATE"
                cv2.putText(annotated_frame, p_text, (px1, py1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)

        event_payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pts_ms": pts_ms,
            "vehicle_count": len(detections),
            "detections": detections
        }

        return annotated_frame, event_payload


def main():
    parser = argparse.ArgumentParser(description="Sentinel AI Inference Pipeline - Multi-Vehicle & ANPR")
    parser.add_argument("--source", type=str, required=True, help="Path to video file or RTSP stream URL")
    parser.add_argument("--vehicle-model", type=str, default="weights/uvh26_yolo11s.pt", help="Vehicle YOLO model path")
    parser.add_argument("--secondary-model", type=str, default="weights/bd_traffic.pt", help="Secondary traffic model")
    parser.add_argument("--coco-model", type=str, default="weights/yolo11n.pt", help="COCO base model path")
    parser.add_argument("--plate-model", type=str, default="weights/license-plate-finetune-v1n.pt", help="Plate YOLO model path")
    parser.add_argument("--ocr-engine", type=str, choices=["easyocr", "paddleocr", "none"], default="easyocr", help="OCR Backend")
    parser.add_argument("--imgsz", type=int, default=640, help="YOLO inference image size")
    parser.add_argument("--conf", type=float, default=0.25, help="YOLO confidence threshold")
    parser.add_argument("--output-json", type=str, default=None, help="Path to output JSON results")
    parser.add_argument("--output-video", type=str, default=None, help="Path to output annotated video file")
    parser.add_argument("--max-frames", type=int, default=None, help="Max frames to process")
    parser.add_argument("--stride", type=int, default=1, help="Frame step stride")
    parser.add_argument("--show", action="store_true", help="Display video stream output window")
    args = parser.parse_args()

    pipeline = SentinelPipeline(
        vehicle_model_path=args.vehicle_model,
        plate_model_path=args.plate_model,
        ocr_engine=args.ocr_engine,
        imgsz=args.imgsz,
        conf=args.conf,
        secondary_model_path=args.secondary_model,
        coco_model_path=args.coco_model
    )

    cap = cv2.VideoCapture(int(args.source) if args.source.isdigit() else args.source)
    if not cap.isOpened():
        sys.exit(f"Error: Could not open video source '{args.source}'")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"[Sentinel AI] Pipeline active. Source: {args.source} ({width}x{height} @ {fps:.1f} FPS, {total_frames} frames)")

    video_writer = None
    if args.output_video:
        out_dir = os.path.dirname(args.output_video)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        video_writer = cv2.VideoWriter(args.output_video, fourcc, fps / args.stride, (width, height))

    events = []
    class_counts = Counter()
    t_start = time.time()
    frame_idx = 0
    processed_count = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            if frame_idx % args.stride != 0:
                continue

            pts_ms = int(cap.get(cv2.CAP_PROP_POS_MSEC)) or int((frame_idx / fps) * 1000)

            annotated_frame, event = pipeline.process_frame(frame, pts_ms=pts_ms)
            events.append(event)
            processed_count += 1

            for d in event.get("detections", []):
                class_counts[d["vehicle_type"]] += 1

            if video_writer:
                video_writer.write(annotated_frame)

            if args.show:
                cv2.imshow("Sentinel AI Inference Pipeline", annotated_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

            if processed_count % 30 == 0:
                elapsed = time.time() - t_start
                print(f"Processed {processed_count} frames... ({processed_count / max(0.001, elapsed):.1f} FPS) | Vehicles in last frame: {event['vehicle_count']}")

            if args.max_frames and processed_count >= args.max_frames:
                break

    finally:
        cap.release()
        if video_writer:
            video_writer.release()
        if args.show:
            cv2.destroyAllWindows()

    elapsed = time.time() - t_start
    print("\n" + "=" * 60)
    print("SENTINEL AI INFERENCE COMPLETED")
    print(f"Processed Frames : {processed_count}")
    print(f"Speed            : {processed_count / max(0.001, elapsed):.1f} FPS")
    print(f"Vehicle Breakdown: {dict(class_counts)}")

    if args.output_json:
        out_dir = os.path.dirname(args.output_json)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
        print(f"Results saved to '{args.output_json}'")


if __name__ == "__main__":
    main()
