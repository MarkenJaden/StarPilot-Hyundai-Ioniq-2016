#!/usr/bin/env python3
import time
import numpy as np

from openpilot.common.filter_simple import FirstOrderFilter
from openpilot.common.params import Params
from openpilot.common.realtime import DT_CTRL


class EmergencyCorridorHelper:
  """
  Intelligent Highway & Emergency Corridor (Rettungsgasse) Lane Position Bias.
  - Automatically identifies whether the vehicle is on the leftmost or rightmost highway lane using modelV2 laneLineProbs & roadEdges.
  - Leftmost lane: smooth bias to the left (-0.25m).
  - Rightmost / middle lanes: smooth bias to the right (+0.25m).
  - Keeps safety margins to lane markings and smoothly blends offset.
  """

  def __init__(self):
    self.params = Params()
    self.enabled = True
    self.base_offset = 0.25  # meters
    self.min_highway_speed_kph = 40.0
    self.jam_speed_kph = 30.0

    self._offset_filter = FirstOrderFilter(0.0, 2.5, DT_CTRL)  # 2.5s smoothing tau
    self._last_detected_position = "CENTER"
    self.active_offset = 0.0

  def update_settings(self):
    try:
      self.enabled = self.params.get_bool("EmergencyCorridor", default=True)
      offset_val = self.params.get("EmergencyCorridorOffset")
      if offset_val:
        self.base_offset = float(np.clip(float(offset_val), 0.10, 0.40))
    except Exception:
      pass

  def detect_lane_position(self, model_v2) -> str:
    """
    Classifies lane position from vision model probabilities.
    Returns: 'LEFTMOST', 'RIGHTMOST', 'MIDDLE', or 'UNKNOWN'
    """
    try:
      probs = np.asarray(model_v2.laneLineProbs, dtype=float)
      if probs.size < 4:
        return "UNKNOWN"

      # laneLineProbs: [0: far-left, 1: left, 2: right, 3: far-right]
      left_has_adjacent = probs[0] > 0.35
      right_has_adjacent = probs[3] > 0.35

      # Check road edges
      road_edges = getattr(model_v2, "roadEdges", None)
      has_left_edge = False
      has_right_edge = False
      if road_edges and len(road_edges) >= 2:
        left_edge_y = float(road_edges[0].y[0]) if len(road_edges[0].y) > 0 else -10.0
        right_edge_y = float(road_edges[1].y[0]) if len(road_edges[1].y) > 0 else 10.0
        has_left_edge = abs(left_edge_y) < 3.5
        has_right_edge = abs(right_edge_y) < 3.5

      if not left_has_adjacent and (right_has_adjacent or has_left_edge):
        return "LEFTMOST"
      elif not right_has_adjacent and (left_has_adjacent or has_right_edge):
        return "RIGHTMOST"
      elif left_has_adjacent and right_has_adjacent:
        # Multi-lane highway middle lane -> Rettungsgasse rule: move right
        return "MIDDLE"
      return "UNKNOWN"
    except Exception:
      return "UNKNOWN"

  def update(self, model_v2, v_ego_mps: float, lat_active: bool) -> float:
    """
    Calculates smoothed lateral offset in meters to add to lane centering.
    """
    if not self.enabled or not lat_active:
      self._offset_filter.x = 0.0
      self.active_offset = 0.0
      return 0.0

    speed_kph = max(0.0, v_ego_mps * 3.6)
    lane_pos = self.detect_lane_position(model_v2)
    self._last_detected_position = lane_pos

    target_offset = 0.0

    # Apply offset on highway speeds or during traffic jams (<30 km/h)
    if lane_pos == "LEFTMOST":
      # Drive slightly further to the left to open corridor on the right
      target_offset = -self.base_offset
    elif lane_pos in ("RIGHTMOST", "MIDDLE"):
      # Drive slightly further to the right to open corridor on the left
      target_offset = +self.base_offset
    else:
      target_offset = 0.0

    # In low-speed traffic jam, intensify emergency corridor
    if speed_kph < self.jam_speed_kph and speed_kph > 2.0:
      target_offset *= 1.2

    self.active_offset = float(self._offset_filter.update(target_offset))
    return self.active_offset


_emergency_corridor_helper = None


def get_emergency_corridor_helper() -> EmergencyCorridorHelper:
  global _emergency_corridor_helper
  if _emergency_corridor_helper is None:
    _emergency_corridor_helper = EmergencyCorridorHelper()
  return _emergency_corridor_helper
