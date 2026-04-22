from __future__ import annotations

from datetime import datetime, timezone
from math import floor
from typing import Any

from .db import DBConnection
from .redis_client import RedisClient

RTD_PREFIX = "google-transit:"
STOP_SCHEDULE_CACHE_PREFIX = "api:stop-schedule"
ROUTE_VEHICLES_CACHE_PREFIX = "api:route-vehicles"


def _strip_rtd_prefix(value: str | None) -> str | None:
    if value is None:
        return None
    if value.startswith(RTD_PREFIX):
        return value[len(RTD_PREFIX):]
    if ":" in value:
        return None
    return value


def _prefix_rtd_id(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith(RTD_PREFIX):
        return value
    if ":" in value:
        return None
    return f"{RTD_PREFIX}{value}"


def _stop_schedule_cache_key(stop_id: str) -> str:
    return f"{STOP_SCHEDULE_CACHE_PREFIX}:{stop_id}"


def _route_vehicles_cache_key(route_id: str) -> str:
    return f"{ROUTE_VEHICLES_CACHE_PREFIX}:{route_id}"


def _minutes_until(timestamp: datetime | None) -> int | None:
    if timestamp is None:
        return None

    now = datetime.now(timezone.utc)
    seconds = (timestamp - now).total_seconds()
    if seconds <= 0:
        return 0
    return floor(seconds / 60)


def _realtime_status(delay_seconds: int, has_live_timestamp: bool) -> str:
    if delay_seconds > 60:
        return "delayed"
    if delay_seconds < -60:
        return "early"
    if has_live_timestamp:
        return "on-time"
    return "scheduled"


def _shape_schedule_entry(row: Any, *, static_stop_id: str) -> dict[str, Any]:
    effective_time = row.get("effective_time")
    delay_seconds = int(row.get("delay_seconds") or 0)
    route_id = row.get("static_route_id") or _prefix_rtd_id(row.get("live_route_id"))
    trip_id = row.get("static_trip_id") or _prefix_rtd_id(row.get("live_trip_id"))

    return {
        "route_id": route_id,
        "route_short_name": row.get("route_short_name"),
        "route_long_name": row.get("route_long_name"),
        "trip_id": trip_id,
        "headsign": row.get("trip_headsign"),
        "scheduled_arrival": row.get("scheduled_arrival") or (effective_time.isoformat() if effective_time else None),
        "minutes_until_arrival": _minutes_until(effective_time),
        "delay_seconds": delay_seconds,
        "realtime_status": _realtime_status(delay_seconds, effective_time is not None),
        "stop_id": static_stop_id,
    }


def _shape_vehicle_entry(row: Any, *, static_route_id: str) -> dict[str, Any]:
    return {
        "route_id": static_route_id,
        "trip_id": _prefix_rtd_id(row.get("trip_id")),
        "vehicle_id": row.get("vehicle_id"),
        "vehicle_label": row.get("vehicle_label"),
        "latitude": row.get("latitude"),
        "longitude": row.get("longitude"),
        "bearing": row.get("bearing"),
        "speed_mps": row.get("speed_mps"),
        "current_status": row.get("current_status"),
        "stop_id": _prefix_rtd_id(row.get("stop_id")),
        "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None,
    }


async def get_stop_schedule(db: DBConnection, redis_client: RedisClient, stop_id: str, *, limit: int = 6) -> list[dict]:
    cache_key = _stop_schedule_cache_key(stop_id)
    cached = await redis_client.get_json(cache_key)
    if cached is not None:
        return cached[:limit]

    raw_stop_id = _strip_rtd_prefix(stop_id)
    if raw_stop_id is None:
        return []

    query = """
    WITH latest_trip_updates AS (
        SELECT DISTINCT ON (COALESCE(trip_id, entity_id, id::text))
            id,
            trip_id,
            route_id,
            delay_seconds,
            timestamp,
            feed_timestamp,
            inserted_at
        FROM trip_updates
        WHERE COALESCE(timestamp, feed_timestamp, inserted_at) >= NOW() - ($2 * INTERVAL '1 second')
        ORDER BY
            COALESCE(trip_id, entity_id, id::text),
            COALESCE(timestamp, feed_timestamp, inserted_at) DESC
    )
    SELECT
        tu.trip_id AS live_trip_id,
        tu.route_id AS live_route_id,
        t.trip_id AS static_trip_id,
        t.route_id AS static_route_id,
        t.trip_headsign,
        r.route_short_name,
        r.route_long_name,
        st.arrival_time AS scheduled_arrival,
        COALESCE(stu.arrival_delay_seconds, stu.departure_delay_seconds, tu.delay_seconds, 0) AS delay_seconds,
        COALESCE(stu.arrival_time, stu.departure_time) AS effective_time
    FROM latest_trip_updates tu
    JOIN stop_time_updates stu ON stu.trip_update_id = tu.id
    LEFT JOIN trips t ON t.trip_id = $3 || tu.trip_id
    LEFT JOIN routes r ON r.route_id = t.route_id
    LEFT JOIN stop_times st
        ON st.trip_id = t.trip_id
       AND (
            (stu.stop_sequence IS NOT NULL AND st.stop_sequence = stu.stop_sequence)
            OR (stu.stop_id IS NOT NULL AND st.stop_id = $1)
       )
    WHERE (
        stu.stop_id = $4
        OR st.stop_id = $1
    )
      AND COALESCE(
            stu.arrival_time,
            stu.departure_time,
            COALESCE(tu.timestamp, tu.feed_timestamp, tu.inserted_at)
      ) >= NOW() - INTERVAL '1 minute'
    ORDER BY
        COALESCE(
            stu.arrival_time,
            stu.departure_time,
            COALESCE(tu.timestamp, tu.feed_timestamp, tu.inserted_at)
        ) ASC NULLS LAST
    LIMIT $5
    """
    rows = await db.fetch(query, stop_id, redis_client.ttl, RTD_PREFIX, raw_stop_id, max(limit, 6))
    schedule = [_shape_schedule_entry(dict(row), static_stop_id=stop_id) for row in rows]
    await redis_client.set_json(cache_key, schedule)
    return schedule[:limit]


async def get_route_vehicles(db: DBConnection, redis_client: RedisClient, route_id: str) -> list[dict]:
    cache_key = _route_vehicles_cache_key(route_id)
    cached = await redis_client.get_json(cache_key)
    if cached is not None:
        return cached

    raw_route_id = _strip_rtd_prefix(route_id)
    if raw_route_id is None:
        return []

    query = """
    WITH latest_positions AS (
        SELECT DISTINCT ON (COALESCE(vehicle_id, entity_id, id::text))
            trip_id,
            route_id,
            vehicle_id,
            vehicle_label,
            latitude,
            longitude,
            bearing,
            speed_mps,
            current_status,
            stop_id,
            COALESCE(vehicle_timestamp, feed_timestamp, inserted_at) AS updated_at
        FROM vehicle_positions
        WHERE route_id = $1
          AND COALESCE(vehicle_timestamp, feed_timestamp, inserted_at) >= NOW() - ($2 * INTERVAL '1 second')
        ORDER BY
            COALESCE(vehicle_id, entity_id, id::text),
            COALESCE(vehicle_timestamp, feed_timestamp, inserted_at) DESC
    )
    SELECT *
    FROM latest_positions
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY updated_at DESC, vehicle_label NULLS LAST, vehicle_id NULLS LAST
    """
    rows = await db.fetch(query, raw_route_id, redis_client.ttl)
    vehicles = [_shape_vehicle_entry(dict(row), static_route_id=route_id) for row in rows]
    await redis_client.set_json(cache_key, vehicles)
    return vehicles
