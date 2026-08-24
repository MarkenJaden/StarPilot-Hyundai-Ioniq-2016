#!/usr/bin/env python3
import time
from openpilot.common.params import Params


class AutoHighBeamController:
  """
  Vision & Radar based Auto High-Beam Assist (HBA) controller for Hyundai CAN.
  - Automatically turns high beam ON when driving in darkness above speed threshold.
  - Dips to low beam when lead vehicles (<120m) or oncoming headlights are detected.
  - Respects driver manual stalk override.
  """

  def __init__(self):
    self.params = Params()
    self.params_memory = Params(memory=True)

    self.hba_enabled = True
    self.min_speed_kph = 35.0
    self.dip_speed_kph = 25.0
    self.switch_delay_s = 1.5

    self.is_high_beam_active = False
    self.last_oncoming_or_lead_time = 0.0
    self.manual_override_active = False
    self.last_stalk_state = False

  def update_settings(self):
    try:
      self.hba_enabled = self.params.get_bool("AutoHighBeam", default=True)
      speed_thresh = self.params.get("AutoHighBeamSpeedThreshold")
      if speed_thresh:
        self.min_speed_kph = float(speed_thresh)
        self.dip_speed_kph = max(15.0, self.min_speed_kph - 10.0)
      delay = self.params.get("AutoHighBeamDelay")
      if delay:
        self.switch_delay_s = float(delay)
    except Exception:
      pass

  def update(
    self,
    v_ego_mps: float,
    lead_status: bool = False,
    lead_d_rel: float | None = None,
    oncoming_detected: bool = False,
    manual_stalk_pressed: bool = False,
    headlights_on: bool = True,
  ) -> tuple[int, int, int]:
    """
    Returns: (hba_sys_state, hba_lamp, hba_opt)
    - hba_sys_state: 0 = Disabled, 1 = Auto Low Beam, 2 = Auto High Beam ON
    - hba_lamp: 1 = HBA Indicator ON
    - hba_opt: 1 = HBA Option enabled on CAN
    """
    now = time.monotonic()
    speed_kph = max(0.0, v_ego_mps * 3.6)

    # Manual driver override detection
    if manual_stalk_pressed and not self.last_stalk_state:
      # Driver actively touched high-beam stalk -> toggle or pause HBA
      self.manual_override_active = not self.manual_override_active
    self.last_stalk_state = manual_stalk_pressed

    if not self.hba_enabled or not headlights_on or self.manual_override_active:
      self.is_high_beam_active = False
      return 0, 0, 1

    # Lead vehicle detected within range
    has_close_lead = lead_status and (lead_d_rel is not None and lead_d_rel < 120.0)

    # Any vehicle in front or oncoming
    target_in_range = has_close_lead or oncoming_detected
    if target_in_range:
      self.last_oncoming_or_lead_time = now

    time_since_target = now - self.last_oncoming_or_lead_time

    # State Machine
    if self.is_high_beam_active:
      # Conditions to DIP back to low beam
      if speed_kph < self.dip_speed_kph or target_in_range:
        self.is_high_beam_active = False
    else:
      # Conditions to ENGAGE high beam
      if speed_kph >= self.min_speed_kph and not target_in_range and time_since_target >= self.switch_delay_s:
        self.is_high_beam_active = True

    hba_sys_state = 2 if self.is_high_beam_active else 1
    hba_lamp = 1
    hba_opt = 1

    return hba_sys_state, hba_lamp, hba_opt


_auto_high_beam_controller = None


def get_auto_high_beam_controller() -> AutoHighBeamController:
  global _auto_high_beam_controller
  if _auto_high_beam_controller is None:
    _auto_high_beam_controller = AutoHighBeamController()
  return _auto_high_beam_controller
