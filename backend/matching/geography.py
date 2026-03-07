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


def normalize_city(raw_location: str | None) -> str | None:
    if raw_location is None:
        return None
    text = str(raw_location).strip()
    if not text:
        return None

    if text in CITY_COORDS:
        return text

    lowered = text.lower()
    for city in CITY_COORDS:
        if city.lower() in lowered:
            return city
    return None


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    return earth_radius * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def distance_km(city_a: str, city_b: str) -> float | None:
    norm_a = normalize_city(city_a)
    norm_b = normalize_city(city_b)
    if norm_a is None or norm_b is None:
        return None
    lat1, lon1 = CITY_COORDS[norm_a]
    lat2, lon2 = CITY_COORDS[norm_b]
    return haversine_km(lat1, lon1, lat2, lon2)
