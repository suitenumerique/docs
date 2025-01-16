"""Decorators for Impress' core application."""

import os
from ipaddress import ip_address, ip_network

from django.http import HttpResponseForbidden


def monitoring_cidr_protected_view(view):
    """
    Decorator to restrict access to a view based on CIDR ranges.

    Checks the client's IP address against allowed CIDR ranges specified
    in the MONITORING_ALLOWED_CIDR_RANGES environment variable. If the
    IP address is not within the allowed ranges, access is denied.
    """

    def wrapped_view(request, *args, **kwargs):
        cidr_env_raw = os.environ.get("MONITORING_ALLOWED_CIDR_RANGES", "")
        cidr_env_stripped = cidr_env_raw.strip().strip('"').strip("'")

        allow_all = cidr_env_stripped == "*"

        allowed_cidr_ranges = []
        if not allow_all:
            try:
                allowed_cidr_ranges = [
                    ip_network(c.strip().strip('"').strip("'"))
                    for c in cidr_env_stripped.split(",")
                    if c.strip()
                ]
            except ValueError as e:
                raise ValueError(
                    f"Invalid CIDR range in MONITORING_ALLOWED_CIDR_RANGES: {e}"
                ) from e

        client_ip = request.META.get("REMOTE_ADDR")

        if allow_all:
            return view(request, *args, **kwargs)

        if not allowed_cidr_ranges:
            return HttpResponseForbidden("No allowed CIDR ranges configured.")

        if not any(ip_address(client_ip) in cidr for cidr in allowed_cidr_ranges):
            return HttpResponseForbidden("Access denied: Your IP is not allowed.")

        return view(request, *args, **kwargs)

    return wrapped_view
