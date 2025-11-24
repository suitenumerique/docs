"""Decorators for Impress' core application."""
from ipaddress import ip_address, ip_network

from django.conf import settings
from django.http import HttpResponseForbidden


def monitoring_cidr_protected_view(view):
    """
    Decorator to restrict access to a view based on CIDR ranges.

    Checks the client's IP address against allowed CIDR ranges specified
    in the MONITORING_ALLOWED_CIDR_RANGES setting. If the
    IP address is not within the allowed ranges, access is denied.
    """

    def wrapped_view(request, *args, **kwargs):
        configured_ranges = [
            str(value).strip().strip('"').strip("'")
            for value in (settings.MONITORING_ALLOWED_CIDR_RANGES or [])
        ]
        configured_ranges = [value for value in configured_ranges if value]

        allow_all = configured_ranges == ["*"]

        allowed_cidr_ranges = []
        if not allow_all:
            try:
                allowed_cidr_ranges = [ip_network(cidr) for cidr in configured_ranges]
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
