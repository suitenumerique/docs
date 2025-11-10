"""Custom Prometheus Metrics Exporter for Impress' core application."""

from datetime import timedelta

from django.conf import settings
from django.db.models import Count, F, Max, Min, Q
from django.utils.timezone import now

from prometheus_client.core import GaugeMetricFamily

from core import models


class CustomMetricsExporter:
    """
    Custom Prometheus metrics collector for various application metrics.

    Metric naming follows Prometheus best practices:
    - leading application (namespace) prefix configured via settings
    - snake_case names with explicit unit/type suffix where relevant
    - use labels inside the metric name
    """

    def collect(self):
        """
        Collect and yield Prometheus metrics for user activity, document activity,
        and document statistics over various time periods.
        """

        namespace = getattr(settings, "PROMETHEUS_METRIC_NAMESPACE", "")

        def metric_name(name):
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
            "total": models.User.objects.count(),
            "active_today": models.User.objects.filter(
                Q(documentaccess__updated_at__gte=times["today_start_utc"])
                | Q(link_traces__created_at__gte=times["today_start_utc"])
                | Q(last_login__gte=times["today_start_utc"])
            )
            .distinct()
            .count(),
            "active_7d": models.User.objects.filter(
                Q(documentaccess__updated_at__gte=times["one_week_ago"])
                | Q(link_traces__created_at__gte=times["one_week_ago"])
                | Q(last_login__gte=times["one_week_ago"])
            )
            .distinct()
            .count(),
            "active_30d": models.User.objects.filter(
                Q(documentaccess__updated_at__gte=times["one_month_ago"])
                | Q(link_traces__created_at__gte=times["one_month_ago"])
                | Q(last_login__gte=times["one_month_ago"])
            )
            .distinct()
            .count(),
        }

        # Group document queries/metrics into a dictionary
        doc_metrics = {
            "total": models.Document.objects.count(),
            "shared": (
                models.Document.objects.annotate(access_count=Count("accesses"))
                .filter(access_count__gt=1)
                .count()
            ),
            "active_today": models.Document.objects.filter(
                updated_at__gte=times["today_start_utc"],
                updated_at__lt=times["today_start_utc"] + timedelta(days=1),
            ).count(),
            "active_7d": models.Document.objects.filter(
                updated_at__gte=times["one_week_ago"]
            ).count(),
            "active_30d": models.Document.objects.filter(
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
                metric_name("users_total"),
                "Current number of users",
                value=user_metrics["total"],
            )
        )
        # Aggregate active users into a single metric with a 'window' label
        active_users_metric = GaugeMetricFamily(
            metric_name("users_active_total"),
            "Users active within the given window",
            labels=["window"],
        )
        active_users_metric.add_metric(["1d"], user_metrics["active_today"])
        active_users_metric.add_metric(["7d"], user_metrics["active_7d"])
        active_users_metric.add_metric(["30d"], user_metrics["active_30d"])
        metrics.append(active_users_metric)

        # -- Document metrics
        metrics.append(
            GaugeMetricFamily(
                metric_name("documents_total"),
                "Current number of documents",
                value=doc_metrics["total"],
            )
        )
        metrics.append(
            GaugeMetricFamily(
                metric_name("documents_shared_total"),
                "Current number of shared documents",
                value=doc_metrics["shared"],
            )
        )
        # Aggregate active documents into a single metric with a 'window' label
        active_documents_metric = GaugeMetricFamily(
            metric_name("documents_active_total"),
            "Documents active within the given window",
            labels=["window"],
        )
        active_documents_metric.add_metric(["1d"], doc_metrics["active_today"])
        active_documents_metric.add_metric(["7d"], doc_metrics["active_7d"])
        active_documents_metric.add_metric(["30d"], doc_metrics["active_30d"])
        metrics.append(active_documents_metric)

        # -- Document oldest/newest creation timestamps in seconds
        if doc_ages["oldest"] or doc_ages["newest"]:
            docs_created_ts_metric = GaugeMetricFamily(
                metric_name("documents_created_timestamp_seconds"),
                "Document creation timestamps (Unix time) for oldest/newest documents",
                labels=["bound"],
            )
            if doc_ages["oldest"]:
                docs_created_ts_metric.add_metric(
                    ["oldest"], doc_ages["oldest"].timestamp()
                )
            if doc_ages["newest"]:
                docs_created_ts_metric.add_metric(
                    ["newest"], doc_ages["newest"].timestamp()
                )
            metrics.append(docs_created_ts_metric)

        # -- User document distribution
        user_distribution_metric = GaugeMetricFamily(
            metric_name("user_documents_total"),
            "Number of documents per user",
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
