import os
import json
import time
import threading
from pathlib import Path
from collections import defaultdict
from cereal import messaging

RECORDINGS_DIR = Path("/data/params/can_recordings" if os.path.exists("/data") else "./can_recordings")


class CANSniffer:
  _instance = None

  def __init__(self):
    self._recording = False
    self._label = ""
    self._start_time = 0.0
    self._frames = []
    self._thread = None
    self._stop_event = threading.Event()
    self._lock = threading.Lock()
    RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)

  @classmethod
  def get_instance(cls):
    if cls._instance is None:
      cls._instance = cls()
    return cls._instance

  def is_recording(self) -> bool:
    return self._recording

  def get_status(self) -> dict:
    with self._lock:
      return {
        "recording": self._recording,
        "label": self._label,
        "elapsed_seconds": round(time.monotonic() - self._start_time, 1) if self._recording else 0.0,
        "frame_count": len(self._frames) if self._recording else 0,
      }

  def start_recording(self, label: str = "Tastendruck") -> dict:
    with self._lock:
      if self._recording:
        return {"status": "already_recording", "label": self._label}
      self._recording = True
      self._label = label.strip() or "Tastendruck"
      self._start_time = time.monotonic()
      self._frames = []
      self._stop_event.clear()
      self._thread = threading.Thread(target=self._capture_worker, daemon=True)
      self._thread.start()
      return {"status": "started", "label": self._label}

  def _capture_worker(self):
    try:
      can_sock = messaging.sub_sock("can", timeout=100)
    except Exception:
      self._recording = False
      return

    while not self._stop_event.is_set():
      try:
        msgs = messaging.drain_sock(can_sock, wait_for_one=True)
        now = time.monotonic()
        t_rel = now - self._start_time
        for msg in msgs:
          for c in msg.can:
            self._frames.append({
              "t": round(t_rel, 3),
              "bus": int(c.bus),
              "address": int(c.address),
              "hex_id": f"0x{c.address:03X}",
              "dat": c.dat.hex(),
            })
            if len(self._frames) > 50000:
              break
      except Exception:
        time.sleep(0.05)

  def stop_recording(self) -> dict:
    with self._lock:
      if not self._recording:
        return {"status": "not_recording"}
      self._stop_event.set()
      self._recording = False

    if self._thread:
      self._thread.join(timeout=2.0)

    duration = round(time.monotonic() - self._start_time, 2)
    analysis = self._analyze_frames(self._frames)

    timestamp_str = time.strftime("%Y%m%d_%H%M%S")
    safe_label = "".join(c if c.isalnum() or c in "-_" else "_" for c in self._label)
    filename = f"{timestamp_str}_{safe_label}.json"
    file_path = RECORDINGS_DIR / filename

    result_data = {
      "id": filename,
      "label": self._label,
      "timestamp": time.strftime("%d.%m.%Y %H:%M:%S"),
      "duration": duration,
      "total_frames": len(self._frames),
      "analysis": analysis,
      "frames_sample": self._frames[:400],
    }

    try:
      with open(file_path, "w") as f:
        json.dump(result_data, f, indent=2)
    except Exception:
      pass

    return result_data

  def _analyze_frames(self, frames) -> dict:
    by_msg = defaultdict(list)
    for f in frames:
      by_msg[(f["address"], f["bus"])].append((f["t"], bytes.fromhex(f["dat"])))

    candidates = []
    for (addr, bus), samples in by_msg.items():
      if len(samples) < 2:
        continue

      unique_payloads = list({s[1] for s in samples})
      if len(unique_payloads) <= 1:
        continue

      max_len = max(len(p) for p in unique_payloads)
      changed_bytes = []
      byte_variations = {}
      for b_idx in range(max_len):
        vals = {p[b_idx] for p in unique_payloads if b_idx < len(p)}
        if len(vals) > 1:
          changed_bytes.append(b_idx)
          byte_variations[b_idx] = sorted(list(vals))

      changes_count = sum(1 for i in range(1, len(samples)) if samples[i][1] != samples[i-1][1])

      candidates.append({
        "address": addr,
        "hex_id": f"0x{addr:03X}",
        "bus": bus,
        "total_messages": len(samples),
        "unique_payload_count": len(unique_payloads),
        "changes_count": changes_count,
        "changed_bytes": changed_bytes,
        "byte_variations": {str(k): [f"0x{v:02X} ({v:08b}b)" for v in vals] for k, vals in byte_variations.items()},
        "sample_hex_values": [p.hex().upper() for p in unique_payloads[:8]],
      })

    candidates.sort(key=lambda c: (0 if 2 <= c["changes_count"] <= 40 else 1, -c["unique_payload_count"]))

    return {
      "candidate_count": len(candidates),
      "candidates": candidates[:20],
    }

  def list_recordings(self) -> list[dict]:
    res = []
    if not RECORDINGS_DIR.exists():
      return []
    for p in sorted(RECORDINGS_DIR.glob("*.json"), reverse=True):
      try:
        with open(p) as f:
          data = json.load(f)
          res.append({
            "id": p.name,
            "label": data.get("label", p.stem),
            "timestamp": data.get("timestamp", ""),
            "duration": data.get("duration", 0),
            "total_frames": data.get("total_frames", 0),
            "candidate_count": len(data.get("analysis", {}).get("candidates", [])),
            "top_candidates": [c["hex_id"] for c in data.get("analysis", {}).get("candidates", [])[:5]],
          })
      except Exception:
        pass
    return res

  def get_recording(self, recording_id: str) -> dict | None:
    path = RECORDINGS_DIR / Path(recording_id).name
    if not path.is_file():
      return None
    try:
      with open(path) as f:
        return json.load(f)
    except Exception:
      return None

  def delete_recording(self, recording_id: str) -> bool:
    path = RECORDINGS_DIR / Path(recording_id).name
    if path.is_file():
      try:
        path.unlink()
        return True
      except Exception:
        return False
    return False


def get_can_sniffer():
  return CANSniffer.get_instance()
