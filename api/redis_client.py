import json
import logging
import redis.asyncio as redis


class RedisClient:
    def __init__(self, redis_url: str | None, ttl: int = 900):
        self.redis_url = redis_url
        self.redis_pool = None
        self.ttl = ttl
        self.logger = logging.getLogger(__name__)

    async def connect(self):
        if self.redis_pool or not self.redis_url:
            return
        self.redis_pool = redis.from_url(self.redis_url, decode_responses=True)

    async def disconnect(self):
        if self.redis_pool:
            await self.redis_pool.aclose()
            self.redis_pool = None

    async def ping(self) -> bool:
        if not self.redis_pool:
            await self.connect()

        if not self.redis_pool:
            return False

        try:
            return bool(await self.redis_pool.ping())
        except Exception as exc:
            self.logger.warning("Realtime Redis ping failed: %s", exc)
            return False

    async def get_json(self, key: str):
        if not self.redis_pool:
            await self.connect()

        if not self.redis_pool:
            return None

        try:
            raw_value = await self.redis_pool.get(key)
            if raw_value is None:
                return None
            return json.loads(raw_value)
        except Exception as exc:
            self.logger.warning("Failed to read realtime cache key %s: %s", key, exc)
            return None

    async def set_json(self, key: str, value, ttl: int | None = None) -> bool:
        if not self.redis_pool:
            await self.connect()

        if not self.redis_pool:
            return False

        try:
            encoded = json.dumps(value, separators=(",", ":"), sort_keys=True)
            await self.redis_pool.set(key, encoded, ex=ttl or self.ttl)
            return True
        except Exception as exc:
            self.logger.warning("Failed to write realtime cache key %s: %s", key, exc)
            return False

    async def publish_entity(self, key: str, channel: str, entity_dict: dict):
        if not self.redis_pool:
            await self.connect()
        
        if not self.redis_pool:
            return

        try:
            entity_json = json.dumps(entity_dict)
            
            async with self.redis_pool.pipeline(transaction=True) as pipe:
                pipe.setex(key, self.ttl, entity_json)
                pipe.publish(channel, entity_json)
                await pipe.execute()
                
        except Exception as exc:
            self.logger.error("Failed to publish entity to %s: %s", key, exc)

    async def get_realtime_updates(self, stop_id: str):
        updates = await self.get_json(stop_id)
        if updates is None:
            return []
        return updates
