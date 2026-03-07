from __future__ import annotations

import math

CITY_COORDS = {
    "Delhi": (28.6139, 77.2090),
    "Mumbai": (19.0760, 72.8777),
    "Hyderabad": (17.3850, 78.4867),
    "Bangalore": (12.9716, 77.5946),
    "Pune": (18.5204, 73.8567),
    "Chennai": (13.0827, 80.2707),
    "Kolkata": (22.5726, 88.3639),
    "Ahmedabad": (23.0225, 72.5714),
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def distance_km(patient_city: str, trial_city: str) -> float | None:
    if patient_city not in CITY_COORDS or trial_city not in CITY_COORDS:
        return None
    p_lat, p_lon = CITY_COORDS[patient_city]
    t_lat, t_lon = CITY_COORDS[trial_city]
    return _haversine_km(p_lat, p_lon, t_lat, t_lon)


def location_score(patient_city: str, trial_city: str) -> float:
    if patient_city == trial_city:
        return 1.0
    dist = distance_km(patient_city, trial_city)
    if dist is None:
        return 0.5
    if dist <= 50:
        return 0.95
    if dist <= 200:
        return 0.8
    if dist <= 600:
        return 0.65
    if dist <= 1200:
        return 0.5
    return 0.35

