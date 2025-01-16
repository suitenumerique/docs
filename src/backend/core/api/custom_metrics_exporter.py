"""Custom Prometheus Metrics Exporter for Impress' core application."""

from datetime import timedelta

from django.conf import settings
from django.db.models import Count, F, Max, Min, Q
from django.utils.timezone import now

from prometheus_client.core import GaugeMetricFamily

from core import models


class CustomMetricsExporter:
    """
    Custom Prometheus metrics collector for various application
    relevant metrics.
    """

    def collect(self):
        """
        Collect and yield Prometheus metrics for user activity, document activity,
        and document statistics over various time periods.
        """

        namespace = getattr(settings, "PROMETHEUS_METRIC_NAMESPACE", "")

        def prefixed_metric_name(name):
            return f"{namespace}_{name}" if namespace else name

        # Group time boundaries into a dictionary to reduce separate local variables
        times = {}
        times["today_start_utc"] = now().replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        times["one_week_ago"] = times["today_start_utc"] - timedelta(days=7)
        times["one_month_ago"] = times["today_start_utc"] - timedelta(days=30)

        # Group user queries/metrics into a dictionary
        user_metrics = {
            "total_users": models.User.objects.count(),
            "active_users_today": models.User.objects.filter(
                Q(documentaccess__updated_at__gte=times["today_start_utc"])
                | Q(link_traces__created_at__gte=times["today_start_utc"])
                | Q(last_login__gte=times["today_start_utc"])
            )
            .distinct()
            .count(),
            "active_users_7_days": models.User.objects.filter(
                Q(documentaccess__updated_at__gte=times["one_week_ago"])
                | Q(link_traces__created_at__gte=times["one_week_ago"])
                | Q(last_login__gte=times["one_week_ago"])
            )
            .distinct()
            .count(),
            "active_users_30_days": models.User.objects.filter(
                Q(documentaccess__updated_at__gte=times["one_month_ago"])
                | Q(link_traces__created_at__gte=times["one_month_ago"])
                | Q(last_login__gte=times["one_month_ago"])
            )
            .distinct()
            .count(),
        }

        # Group document queries/metrics into a dictionary
        doc_metrics = {
            "total_documents": models.Document.objects.count(),
            "shared_docs_count": (
                models.Document.objects.annotate(access_count=Count("accesses"))
                .filter(access_count__gt=1)
                .count()
            ),
            "active_docs_today": models.Document.objects.filter(
                updated_at__gte=times["today_start_utc"],
                updated_at__lt=times["today_start_utc"] + timedelta(days=1),
            ).count(),
            "active_docs_last_7_days": models.Document.objects.filter(
                updated_at__gte=times["one_week_ago"]
            ).count(),
            "active_docs_last_30_days": models.Document.objects.filter(
                updated_at__gte=times["one_month_ago"]
            ).count(),
        }

        # Use a single aggregation call for oldest/newest document creation date
        doc_ages = models.Document.objects.aggregate(
            oldest=Min("created_at"),
            newest=Max("created_at"),
        )

        # Prepare user distribution data
        user_doc_counts = models.DocumentAccess.objects.values("user_id").annotate(
            doc_count=Count("document_id"), admin_email=F("user__admin_email")
        )

        # Collect all metrics in one list
        metrics = []

        # -- User metrics
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("total_users"),
                "Total number of users",
                value=user_metrics["total_users"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("active_users_today"),
                "Number of active users today",
                value=user_metrics["active_users_today"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("active_users_7_days"),
                "Number of active users in the last 7 days",
                value=user_metrics["active_users_7_days"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("active_users_30_days"),
                "Number of active users in the last 30 days",
                value=user_metrics["active_users_30_days"],
            )
        )

        # -- Document metrics
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("total_documents"),
                "Total number of documents",
                value=doc_metrics["total_documents"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("shared_documents"),
                "Number of shared documents",
                value=doc_metrics["shared_docs_count"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("active_documents_today"),
                "Number of active documents today",
                value=doc_metrics["active_docs_today"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("active_documents_7_days"),
                "Number of active documents in the last 7 days",
                value=doc_metrics["active_docs_last_7_days"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                prefixed_metric_name("active_documents_30_days"),
                "Number of active documents in the last 30 days",
                value=doc_metrics["active_docs_last_30_days"],
            )
        )

        # -- Document oldest/newest timestamps
        if doc_ages["oldest"]:
            metrics.append(
                GaugeMetricFamily(
                    prefixed_metric_name("oldest_document_date"),
                    "Timestamp of the oldest document creation date",
                    value=doc_ages["oldest"].timestamp(),
                )
            )
        if doc_ages["newest"]:
            metrics.append(
                GaugeMetricFamily(
                    prefixed_metric_name("newest_document_date"),
                    "Timestamp of the newest document creation date",
                    value=doc_ages["newest"].timestamp(),
                )
            )

        # -- User document distribution
        user_distribution_metric = GaugeMetricFamily(
            prefixed_metric_name("user_document_distribution"),
            "Document counts per user",
            labels=["user_email"],
        )
        for user in user_doc_counts:
            if user["admin_email"]:  # Validate email existence
                user_distribution_metric.add_metric(
                    [user["admin_email"]], user["doc_count"]
                )
        metrics.append(user_distribution_metric)

        # Yield from metrics
        yield from metrics
