import unittest
from datetime import datetime, timedelta, timezone

from api.services import (
    get_nearest_stations_with_realtime,
    get_route_vehicles_realtime,
    get_stop_schedule_with_realtime,
)


class FakeDB:
    def __init__(self, *, stop_rows=None, schedule_rows=None, vehicle_rows=None):
        self.stop_rows = stop_rows or []
        self.schedule_rows = schedule_rows or []
        self.vehicle_rows = vehicle_rows or []
        self.fetch_calls = []

    async def fetch(self, query: str, *args):
        self.fetch_calls.append((query, args))
        if "FROM vehicle_positions" in query:
            return self.vehicle_rows
        if "FROM trip_updates" in query:
            return self.schedule_rows
        if "FROM stops" in query:
            limit = args[2]
            return self.stop_rows[:limit]
        return []


class FakeRedis:
    def __init__(self, initial_cache=None, ttl=900):
        self.cache = dict(initial_cache or {})
        self.ttl = ttl
        self.set_calls = []

    async def get_json(self, key: str):
        return self.cache.get(key)

    async def set_json(self, key: str, value, ttl: int | None = None):
        self.set_calls.append((key, value, ttl))
        self.cache[key] = value
        return True


class RealtimeServiceTests(unittest.IsolatedAsyncioTestCase):
    def make_schedule_row(self):
        return {
            "live_trip_id": "trip-1",
            "live_route_id": "A",
            "static_trip_id": "google-transit:trip-1",
            "static_route_id": "google-transit:A",
            "trip_headsign": "Denver Airport Station",
            "route_short_name": "A",
            "route_long_name": "A Line",
            "scheduled_arrival": "12:00:00",
            "delay_seconds": 120,
            "effective_time": datetime.now(timezone.utc) + timedelta(minutes=5),
        }

    async def test_stop_schedule_uses_cached_payload_before_postgres(self):
        cached_payload = [
            {
                "route_id": "google-transit:A",
                "route_short_name": "A",
                "route_long_name": "A Line",
                "trip_id": "google-transit:trip-1",
                "headsign": "Denver Airport Station",
                "scheduled_arrival": "12:00:00",
                "minutes_until_arrival": 4,
                "delay_seconds": 0,
                "realtime_status": "on-time",
                "stop_id": "google-transit:stop-1",
            }
        ]
        db = FakeDB()
        redis_client = FakeRedis({"api:stop-schedule:google-transit:stop-1": cached_payload})

        schedule = await get_stop_schedule_with_realtime(db, redis_client, "google-transit:stop-1")

        self.assertEqual(schedule, cached_payload)
        self.assertEqual(db.fetch_calls, [])

    async def test_stop_schedule_falls_back_to_postgres_and_caches_result(self):
        db = FakeDB(schedule_rows=[self.make_schedule_row()])
        redis_client = FakeRedis()

        schedule = await get_stop_schedule_with_realtime(db, redis_client, "google-transit:stop-1")

        self.assertEqual(len(schedule), 1)
        self.assertEqual(schedule[0]["route_id"], "google-transit:A")
        self.assertEqual(schedule[0]["trip_id"], "google-transit:trip-1")
        self.assertEqual(schedule[0]["realtime_status"], "delayed")
        self.assertTrue(redis_client.set_calls)
        self.assertEqual(redis_client.set_calls[0][0], "api:stop-schedule:google-transit:stop-1")

    async def test_nearest_stations_enriches_with_postgres_fallback_schedule(self):
        stop_rows = [
            {
                "stop_id": "google-transit:stop-1",
                "stop_name": "Union Station",
                "latitude": 39.7527,
                "longitude": -105.0001,
                "distance_meters": 120.5,
            }
        ]
        db = FakeDB(stop_rows=stop_rows, schedule_rows=[self.make_schedule_row()])
        redis_client = FakeRedis()

        stations = await get_nearest_stations_with_realtime(db, redis_client, 39.7392, -104.9903, 1)

        self.assertEqual(len(stations), 1)
        self.assertEqual(stations[0]["stop_id"], "google-transit:stop-1")
        self.assertEqual(stations[0]["next_arrivals"][0]["route_id"], "google-transit:A")

    async def test_route_vehicles_fall_back_to_postgres_and_normalize_ids(self):
        vehicle_rows = [
            {
                "trip_id": "trip-1",
                "route_id": "A",
                "vehicle_id": "veh-12",
                "vehicle_label": "Train 12",
                "latitude": 39.75,
                "longitude": -105.0,
                "bearing": 180.0,
                "speed_mps": 12.5,
                "current_status": "IN_TRANSIT_TO",
                "stop_id": "stop-1",
                "updated_at": datetime.now(timezone.utc),
            }
        ]
        db = FakeDB(vehicle_rows=vehicle_rows)
        redis_client = FakeRedis()

        vehicles = await get_route_vehicles_realtime(db, redis_client, "google-transit:A")

        self.assertEqual(len(vehicles), 1)
        self.assertEqual(vehicles[0]["route_id"], "google-transit:A")
        self.assertEqual(vehicles[0]["trip_id"], "google-transit:trip-1")
        self.assertEqual(vehicles[0]["stop_id"], "google-transit:stop-1")
