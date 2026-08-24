import json
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path


class DrivingPhase(str, Enum):
  EV_DRIVING = "ev_driving"              # Pure electric driving (Engine off, moving)
  REGEN_BRAKING = "regen_braking"        # Regenerative braking / deceleration with energy recovery
  DECEL_FUEL_CUT = "decel_fuel_cut"      # Engine overrun / fuel cut (coasting)
  ICE_CRUISE = "ice_cruise"              # Internal combustion engine cruising (steady moderate load)
  ICE_ACCELERATION = "ice_acceleration"  # Internal combustion engine high load / acceleration
  IDLE_ENGINE_OFF = "idle_engine_off"    # Standstill with engine stopped (auto-stop / EV idle)
  IDLE_ENGINE_ON = "idle_engine_on"      # Standstill with engine running (charging / heating)


@dataclass
class PhaseMetrics:
  duration_s: float = 0.0
  distance_m: float = 0.0
  fuel_consumed_ml: float = 0.0
  regen_energy_wh: float = 0.0
  sample_count: int = 0
  avg_speed_kph: float = 0.0
  avg_rpm: float = 0.0
  avg_l_per_100km: float = 0.0


class FuelEfficiencyTracker:
  """
  Real-time fuel consumption and hybrid phase analytics tracker.
  Supports:
  1. Automatic single drive reports upon parking.
  2. Tank-to-tank (full refuel) cycle tracking.
  3. Unlimited named custom trips.
  """

  def __init__(self, storage_dir: str | None = None):
    self.base_dir = Path(storage_dir or os.path.expanduser("~/.comma/fuel_tracker"))
    try:
      self.base_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
      self.base_dir = Path("/tmp/fuel_tracker")
      self.base_dir.mkdir(parents=True, exist_ok=True)

    self.drives_dir = self.base_dir / "drives"
    self.tanks_dir = self.base_dir / "tanks"
    self.custom_trips_dir = self.base_dir / "custom_trips"

    for d in (self.drives_dir, self.tanks_dir, self.custom_trips_dir):
      d.mkdir(parents=True, exist_ok=True)

    self._reset_current_drive()
    self._load_tanks()
    self._load_custom_trips()

    self.last_step_time = time.monotonic()
    self.prev_is_onroad = False
    self.standstill_since = None

  def _reset_current_drive(self):
    self.drive_id = f"drive_{time.strftime('%Y%m%d_%H%M%S')}"
    self.drive_start_ts = time.time()
    self.total_duration_s = 0.0
    self.total_distance_m = 0.0
    self.total_fuel_ml = 0.0
    self.total_regen_wh = 0.0

    self.current_phase = DrivingPhase.IDLE_ENGINE_OFF
    self.current_instant_l_per_100km = 0.0
    self.current_instant_l_per_hour = 0.0
    self.current_rpm = 0.0
    self.current_speed_kph = 0.0
    self.current_engine_load = 0.0
    self.is_ev_mode = True
    self.is_regen_active = False

    self.phase_stats: dict[DrivingPhase, PhaseMetrics] = {
      phase: PhaseMetrics() for phase in DrivingPhase
    }

  # --- Tank-to-Tank Cycle Management ---

  def _load_tanks(self):
    self.tank_history_file = self.tanks_dir / "tank_history.json"
    self.current_tank_file = self.tanks_dir / "current_tank.json"

    self.tank_history = []
    if self.tank_history_file.exists():
      try:
        with open(self.tank_history_file, "r", encoding="utf-8") as f:
          self.tank_history = json.load(f)
      except Exception:
        self.tank_history = []

    self.current_tank = {
      "tankId": f"tank_{time.strftime('%Y%m%d_%H%M%S')}",
      "startTime": time.time(),
      "totalDistanceKm": 0.0,
      "totalDurationHours": 0.0,
      "totalFuelLiters": 0.0,
      "totalRegenKWh": 0.0,
      "evDistanceKm": 0.0,
      "drivesCount": 0,
      "avgLPer100km": 0.0,
      "evDistancePct": 0.0,
      "lastRefuelLiters": None,
      "pricePerLiterEur": 1.75,
    }

    if self.current_tank_file.exists():
      try:
        with open(self.current_tank_file, "r", encoding="utf-8") as f:
          self.current_tank.update(json.load(f))
      except Exception:
        pass

  def _save_current_tank(self):
    try:
      with open(self.current_tank_file, "w", encoding="utf-8") as f:
        json.dump(self.current_tank, f, indent=2)
    except Exception as e:
      print(f"Error saving current tank: {e}")

  def _save_tank_history(self):
    try:
      with open(self.tank_history_file, "w", encoding="utf-8") as f:
        json.dump(self.tank_history, f, indent=2)
    except Exception as e:
      print(f"Error saving tank history: {e}")

  def record_refuel(self, refueled_liters: float | None = None, price_per_liter: float | None = None, notes: str = "") -> dict:
    """Archives the current tank session and starts a new tank session."""
    completed_tank = dict(self.current_tank)
    completed_tank["endTime"] = time.time()
    completed_tank["actualRefueledLiters"] = refueled_liters
    completed_tank["pricePerLiterEur"] = price_per_liter or completed_tank.get("pricePerLiterEur", 1.75)
    completed_tank["notes"] = notes

    # Calculate actual fuel efficiency from pump if refueled liters provided
    if refueled_liters and completed_tank["totalDistanceKm"] > 10.0:
      completed_tank["actualLPer100km"] = round((refueled_liters / completed_tank["totalDistanceKm"]) * 100.0, 2)
      completed_tank["totalCostEur"] = round(refueled_liters * completed_tank["pricePerLiterEur"], 2)
    elif completed_tank["totalFuelLiters"] > 0:
      completed_tank["totalCostEur"] = round(completed_tank["totalFuelLiters"] * completed_tank["pricePerLiterEur"], 2)

    self.tank_history.insert(0, completed_tank)
    self._save_tank_history()

    # Start new current tank
    self.current_tank = {
      "tankId": f"tank_{time.strftime('%Y%m%d_%H%M%S')}",
      "startTime": time.time(),
      "totalDistanceKm": 0.0,
      "totalDurationHours": 0.0,
      "totalFuelLiters": 0.0,
      "totalRegenKWh": 0.0,
      "evDistanceKm": 0.0,
      "drivesCount": 0,
      "avgLPer100km": 0.0,
      "evDistancePct": 0.0,
      "lastRefuelLiters": refueled_liters,
      "pricePerLiterEur": price_per_liter or 1.75,
    }
    self._save_current_tank()
    return completed_tank

  # --- Custom Named Trips Management ---

  def _load_custom_trips(self):
    self.trips_file = self.custom_trips_dir / "trips.json"
    self.custom_trips = []
    if self.trips_file.exists():
      try:
        with open(self.trips_file, "r", encoding="utf-8") as f:
          self.custom_trips = json.load(f)
      except Exception:
        self.custom_trips = []

  def _save_custom_trips(self):
    try:
      with open(self.trips_file, "w", encoding="utf-8") as f:
        json.dump(self.custom_trips, f, indent=2)
    except Exception as e:
      print(f"Error saving custom trips: {e}")

  def create_custom_trip(self, name: str, description: str = "") -> dict:
    """Creates a new named custom trip."""
    trip = {
      "id": str(uuid.uuid4())[:8],
      "name": name.strip() or f"Trip {len(self.custom_trips) + 1}",
      "description": description.strip(),
      "createdAt": time.time(),
      "active": True,
      "drivesCount": 0,
      "totalDistanceKm": 0.0,
      "totalDurationHours": 0.0,
      "totalFuelLiters": 0.0,
      "totalRegenKWh": 0.0,
      "evDistanceKm": 0.0,
      "avgLPer100km": 0.0,
      "evDistancePct": 0.0,
    }
    self.custom_trips.insert(0, trip)
    self._save_custom_trips()
    return trip

  def toggle_custom_trip(self, trip_id: str) -> dict | None:
    for t in self.custom_trips:
      if t["id"] == trip_id:
        t["active"] = not t.get("active", True)
        self._save_custom_trips()
        return t
    return None

  def delete_custom_trip(self, trip_id: str) -> bool:
    initial_len = len(self.custom_trips)
    self.custom_trips = [t for t in self.custom_trips if t["id"] != trip_id]
    if len(self.custom_trips) < initial_len:
      self._save_custom_trips()
      return True
    return False

  # --- Calculations & Physics Model ---

  def calculate_instant_fuel_rate(self, rpm: float, engine_load_pct: float, speed_kph: float, is_engine_running: bool, is_fuel_cut: bool) -> tuple[float, float]:
    """Calculates fuel rate in L/h and L/100km for 1.6L Kappa GDI."""
    if not is_engine_running or rpm < 350.0 or is_fuel_cut:
      return 0.0, 0.0

    ve = 0.70 + 0.25 * (min(max(engine_load_pct, 0.0), 100.0) / 100.0)
    load_factor = max(0.08, min(engine_load_pct / 100.0, 1.0))
    fuel_l_per_hour = (rpm * 60.0 * 1.580 * 0.5 * 1.2 * load_factor * ve) / (14.7 * 745.0 * 1000.0) * 1000.0
    fuel_l_per_hour = max(0.45, min(fuel_l_per_hour, 32.0))

    l_per_100km = (fuel_l_per_hour / speed_kph * 100.0) if speed_kph > 1.5 else 0.0
    return fuel_l_per_hour, l_per_100km

  def determine_phase(self, speed_kph: float, rpm: float, gas_pressed: bool, brake_pressed: bool, regen_active: bool, fuel_cut: bool, engine_load_pct: float) -> DrivingPhase:
    is_moving = speed_kph > 1.2
    is_engine_on = rpm > 450.0

    if not is_moving:
      return DrivingPhase.IDLE_ENGINE_ON if is_engine_on else DrivingPhase.IDLE_ENGINE_OFF

    if regen_active or (brake_pressed and speed_kph > 3.0):
      return DrivingPhase.REGEN_BRAKING

    if not is_engine_on:
      return DrivingPhase.EV_DRIVING

    if fuel_cut or (not gas_pressed and speed_kph > 15.0 and engine_load_pct < 10.0):
      return DrivingPhase.DECEL_FUEL_CUT

    if engine_load_pct > 40.0 or rpm > 2400.0:
      return DrivingPhase.ICE_ACCELERATION

    return DrivingPhase.ICE_CRUISE

  def update(self, v_ego_mps: float, engine_rpm: float | None = None, gas_pos_pct: float = 0.0, brake_pressed: bool = False, regen_active: bool = False, engine_torque_pct: float = 0.0, fuel_cut: bool = False, is_onroad: bool = True, fuel_level_segments: float | None = None, refuel_det_mode: bool = False, dte_km: float | None = None):
    now = time.monotonic()
    dt = min(max(now - self.last_step_time, 0.001), 1.0)
    self.last_step_time = now

    speed_kph = max(0.0, v_ego_mps * 3.6)
    rpm = max(0.0, engine_rpm if engine_rpm is not None else (0.0 if not gas_pos_pct and speed_kph < 30 else 1200.0))
    engine_load = max(0.0, min(100.0, max(gas_pos_pct, engine_torque_pct)))
    is_engine_running = rpm > 450.0

    # Auto-save Drive Report when vehicle transitions from onroad to offroad
    if self.prev_is_onroad and not is_onroad:
      self._finalize_and_save_drive()

    self.prev_is_onroad = is_onroad

    # Auto-detect refuel from CAN signals (Fuel Level Rise, Refuel Flag, or DTE Jump)
    if fuel_level_segments is not None and fuel_level_segments > 0:
      if getattr(self, "last_fuel_level", None) is not None:
        delta_level = fuel_level_segments - self.last_fuel_level
        # A rise of 6 segments (out of 31) represents approx +20% tank refill (~8.5+ Liters)
        if (refuel_det_mode or delta_level >= 6) and self.current_tank.get("totalDistanceKm", 0.0) >= 20.0:
          refueled_liters = round((delta_level / 31.0) * 43.0, 1)  # 43L Ioniq tank
          self.record_refuel(refueled_liters=refueled_liters, notes="Automatisch erkannt (Tacho-Tankung)")
      self.last_fuel_level = fuel_level_segments

    if dte_km is not None and dte_km > 0:
      if getattr(self, "last_dte", None) is not None:
        delta_dte = dte_km - self.last_dte
        if delta_dte >= 180.0 and self.current_tank.get("totalDistanceKm", 0.0) >= 20.0:
          self.record_refuel(refueled_liters=None, notes="Automatisch erkannt (Reichweitenanstieg)")
      self.last_dte = dte_km

    l_per_h, l_per_100km = self.calculate_instant_fuel_rate(
      rpm=rpm,
      engine_load_pct=engine_load,
      speed_kph=speed_kph,
      is_engine_running=is_engine_running,
      is_fuel_cut=fuel_cut
    )

    phase = self.determine_phase(
      speed_kph=speed_kph,
      rpm=rpm,
      gas_pressed=gas_pos_pct > 2.0,
      brake_pressed=brake_pressed,
      regen_active=regen_active,
      fuel_cut=fuel_cut,
      engine_load_pct=engine_load
    )

    step_distance_m = v_ego_mps * dt
    step_fuel_ml = (l_per_h * 1000.0 / 3600.0) * dt
    step_regen_wh = 0.0
    if phase == DrivingPhase.REGEN_BRAKING:
      step_regen_wh = (min(speed_kph / 100.0 * 18000.0, 25000.0) * dt) / 3600.0

    # Accumulate current drive
    self.total_duration_s += dt
    self.total_distance_m += step_distance_m
    self.total_fuel_ml += step_fuel_ml
    self.total_regen_wh += step_regen_wh

    # Accumulate phase metrics
    pm = self.phase_stats[phase]
    pm.duration_s += dt
    pm.distance_m += step_distance_m
    pm.fuel_consumed_ml += step_fuel_ml
    pm.regen_energy_wh += step_regen_wh
    pm.sample_count += 1
    pm.avg_speed_kph = (pm.avg_speed_kph * (pm.sample_count - 1) + speed_kph) / pm.sample_count
    pm.avg_rpm = (pm.avg_rpm * (pm.sample_count - 1) + rpm) / pm.sample_count
    if pm.distance_m > 50.0:
      pm.avg_l_per_100km = (pm.fuel_consumed_ml / 1000.0) / (pm.distance_m / 100000.0)
    elif pm.duration_s > 10.0:
      pm.avg_l_per_100km = (pm.fuel_consumed_ml / 1000.0) / (pm.duration_s / 3600.0)

    # Live properties
    self.current_phase = phase
    self.current_speed_kph = speed_kph
    self.current_rpm = rpm
    self.current_engine_load = engine_load
    self.current_instant_l_per_100km = l_per_100km
    self.current_instant_l_per_hour = l_per_h
    self.is_ev_mode = (phase in (DrivingPhase.EV_DRIVING, DrivingPhase.IDLE_ENGINE_OFF, DrivingPhase.REGEN_BRAKING))
    self.is_regen_active = (phase == DrivingPhase.REGEN_BRAKING)

  def _finalize_and_save_drive(self) -> dict | None:
    """Finalizes current drive, persists report, and adds to active tank and custom trips."""
    if self.total_distance_m < 150.0 and self.total_duration_s < 20.0:
      self._reset_current_drive()
      return None

    report = self.get_trip_statistics()
    report["driveId"] = self.drive_id
    report["endTime"] = time.time()

    # Save drive report file
    file_path = self.drives_dir / f"{self.drive_id}.json"
    try:
      with open(file_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    except Exception as e:
      print(f"Error saving drive report: {e}")

    # Accumulate into current tank
    dist_km = report["tripDistanceKm"]
    fuel_l = report["tripFuelLiters"]
    regen_kwh = report["tripRegenKWh"]
    dur_h = report["tripDurationSeconds"] / 3600.0
    ev_km = (self.phase_stats[DrivingPhase.EV_DRIVING].distance_m + self.phase_stats[DrivingPhase.REGEN_BRAKING].distance_m) / 1000.0

    self.current_tank["totalDistanceKm"] = round(self.current_tank.get("totalDistanceKm", 0.0) + dist_km, 2)
    self.current_tank["totalFuelLiters"] = round(self.current_tank.get("totalFuelLiters", 0.0) + fuel_l, 3)
    self.current_tank["totalRegenKWh"] = round(self.current_tank.get("totalRegenKWh", 0.0) + regen_kwh, 3)
    self.current_tank["totalDurationHours"] = round(self.current_tank.get("totalDurationHours", 0.0) + dur_h, 2)
    self.current_tank["evDistanceKm"] = round(self.current_tank.get("evDistanceKm", 0.0) + ev_km, 2)
    self.current_tank["drivesCount"] = int(self.current_tank.get("drivesCount", 0)) + 1
    if self.current_tank["totalDistanceKm"] > 0.05:
      self.current_tank["avgLPer100km"] = round((self.current_tank["totalFuelLiters"] / self.current_tank["totalDistanceKm"]) * 100.0, 2)
      self.current_tank["evDistancePct"] = round((self.current_tank["evDistanceKm"] / self.current_tank["totalDistanceKm"]) * 100.0, 1)
    self._save_current_tank()

    # Accumulate into active custom trips
    for trip in self.custom_trips:
      if trip.get("active", True):
        trip["totalDistanceKm"] = round(trip.get("totalDistanceKm", 0.0) + dist_km, 2)
        trip["totalFuelLiters"] = round(trip.get("totalFuelLiters", 0.0) + fuel_l, 3)
        trip["totalRegenKWh"] = round(trip.get("totalRegenKWh", 0.0) + regen_kwh, 3)
        trip["totalDurationHours"] = round(trip.get("totalDurationHours", 0.0) + dur_h, 2)
        trip["evDistanceKm"] = round(trip.get("evDistanceKm", 0.0) + ev_km, 2)
        trip["drivesCount"] = int(trip.get("drivesCount", 0)) + 1
        if trip["totalDistanceKm"] > 0.05:
          trip["avgLPer100km"] = round((trip["totalFuelLiters"] / trip["totalDistanceKm"]) * 100.0, 2)
          trip["evDistancePct"] = round((trip["evDistanceKm"] / trip["totalDistanceKm"]) * 100.0, 1)
    self._save_custom_trips()

    self._reset_current_drive()
    return report

  # --- Payload Getters ---

  def get_live_payload(self) -> dict:
    total_km = self.total_distance_m / 1000.0
    overall_l_per_100km = 0.0
    if total_km > 0.05:
      overall_l_per_100km = (self.total_fuel_ml / 1000.0) / (total_km / 100.0)

    ev_dist_m = self.phase_stats[DrivingPhase.EV_DRIVING].distance_m + self.phase_stats[DrivingPhase.REGEN_BRAKING].distance_m
    ev_time_s = self.phase_stats[DrivingPhase.EV_DRIVING].duration_s + self.phase_stats[DrivingPhase.REGEN_BRAKING].duration_s + self.phase_stats[DrivingPhase.IDLE_ENGINE_OFF].duration_s

    ev_dist_pct = (ev_dist_m / max(self.total_distance_m, 1.0)) * 100.0
    ev_time_pct = (ev_time_s / max(self.total_duration_s, 1.0)) * 100.0

    return {
      "timestamp": time.time(),
      "driveId": self.drive_id,
      "currentPhase": self.current_phase.value,
      "speedKph": round(self.current_speed_kph, 1),
      "engineRpm": int(round(self.current_rpm)),
      "engineLoadPct": round(self.current_engine_load, 1),
      "instantLPer100km": round(self.current_instant_l_per_100km, 2),
      "instantLPerHour": round(self.current_instant_l_per_hour, 2),
      "isEvMode": self.is_ev_mode,
      "isRegenActive": self.is_regen_active,
      "tripDurationSeconds": round(self.total_duration_s, 1),
      "tripDistanceKm": round(total_km, 2),
      "tripFuelLiters": round(self.total_fuel_ml / 1000.0, 3),
      "tripAvgLPer100km": round(overall_l_per_100km, 2),
      "tripRegenKWh": round(self.total_regen_wh / 1000.0, 3),
      "evDistancePct": round(ev_dist_pct, 1),
      "evTimePct": round(ev_time_pct, 1),
    }

  def get_trip_statistics(self) -> dict:
    live = self.get_live_payload()
    phases_dict = {}
    for phase, metrics in self.phase_stats.items():
      dist_km = metrics.distance_m / 1000.0
      fuel_l = metrics.fuel_consumed_ml / 1000.0
      time_pct = (metrics.duration_s / max(self.total_duration_s, 0.001)) * 100.0
      dist_pct = (metrics.distance_m / max(self.total_distance_m, 0.001)) * 100.0

      phases_dict[phase.value] = {
        "durationSeconds": round(metrics.duration_s, 1),
        "timePercent": round(time_pct, 1),
        "distanceKm": round(dist_km, 2),
        "distancePercent": round(dist_pct, 1),
        "fuelLiters": round(fuel_l, 3),
        "avgLPer100km": round(metrics.avg_l_per_100km, 2),
        "avgSpeedKph": round(metrics.avg_speed_kph, 1),
        "avgRpm": int(round(metrics.avg_rpm)),
        "regenKWh": round(metrics.regen_energy_wh / 1000.0, 3),
      }

    return {
      **live,
      "startTime": self.drive_start_ts,
      "phases": phases_dict,
    }

  def list_drive_reports(self) -> list[dict]:
    reports = []
    try:
      for p in sorted(self.drives_dir.glob("drive_*.json"), reverse=True):
        try:
          with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["filename"] = p.name
            reports.append(data)
        except Exception:
          continue
    except Exception:
      pass
    return reports[:100]

  def get_drive_report(self, drive_id: str) -> dict | None:
    path = self.drives_dir / f"{drive_id}.json"
    if not path.exists():
      path = self.drives_dir / drive_id
    if path.exists():
      try:
        with open(path, "r", encoding="utf-8") as f:
          return json.load(f)
      except Exception:
        pass
    return None


_tracker_instance: FuelEfficiencyTracker | None = None

def get_fuel_tracker() -> FuelEfficiencyTracker:
  global _tracker_instance
  if _tracker_instance is None:
    _tracker_instance = FuelEfficiencyTracker()
  return _tracker_instance
