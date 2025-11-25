"""
Custom Prometheus cache backends with corrected get() semantics.

Workaround until https://github.com/django-commons/django-prometheus/issues/493 is fixed
Once fixed:
- Delete this file entirely
- In settings.py, replace occurrences of 'impress.prometheus_cache'
  with the *correct* 'django_prometheus.cache' equivalents;
E.g: 'impress.prometheus_cache.LocMemCache' -> 'django_prometheus.cache.backends.locmem.LocMemCache'
"""

from django.core.cache.backends import filebased as django_filebased
from django.core.cache.backends import locmem as django_locmem
from django_prometheus.cache.backends import filebased, locmem
from django_prometheus.cache.metrics import (
    django_cache_get_total,
    django_cache_hits_total,
    django_cache_misses_total,
)

try:
    from django_prometheus.cache.backends import django_memcached_consul as prom_memcached_consul
    from django_memcached_consul import memcached as django_memcached
except ImportError:
    prom_memcached_consul = None
    django_memcached = None


class LocMemCache(locmem.LocMemCache):
    def get(self, key, default=None, version=None):
        django_cache_get_total.labels(backend="locmem").inc()
        cached = django_locmem.LocMemCache.get(self, key, default=default, version=version)
        if cached is default:
            django_cache_misses_total.labels(backend="locmem").inc()
        else:
            django_cache_hits_total.labels(backend="locmem").inc()
        return cached


class FileBasedCache(filebased.FileBasedCache):
    def get(self, key, default=None, version=None):
        django_cache_get_total.labels(backend="filebased").inc()
        cached = django_filebased.FileBasedCache.get(
            self, key, default=default, version=version
        )
        if cached is default:
            django_cache_misses_total.labels(backend="filebased").inc()
        else:
            django_cache_hits_total.labels(backend="filebased").inc()
        return cached


if prom_memcached_consul and django_memcached:
    class MemcachedConsulCache(prom_memcached_consul.MemcachedCache):
        def get(self, key, default=None, version=None):
            django_cache_get_total.labels(backend="django_memcached_consul").inc()
            cached = django_memcached.MemcachedCache.get(
                self, key, default=default, version=version
            )
            if cached is default:
                django_cache_misses_total.labels(backend="django_memcached_consul").inc()
            else:
                django_cache_hits_total.labels(backend="django_memcached_consul").inc()
            return cached
else:
    MemcachedConsulCache = None  # type: ignore
