"""Forms for the core app."""

from django import forms
from django.conf import settings


class RunIndexingForm(forms.Form):
    """
    Form for running the indexing process.
    """

    batch_size = forms.IntegerField(
        min_value=1,
        initial=settings.SEARCH_INDEXER_BATCH_SIZE,
    )
    lower_time_bound = forms.DateTimeField(
        required=False, widget=forms.TextInput(attrs={"type": "datetime-local"})
    )
    upper_time_bound = forms.DateTimeField(
        required=False, widget=forms.TextInput(attrs={"type": "datetime-local"})
    )

    def clean(self):
        """Override clean to validate time bounds."""
        cleaned_data = super().clean()
        self.check_time_bounds()
        return cleaned_data

    def check_time_bounds(self):
        """Validate that lower_time_bound is before upper_time_bound."""
        lower_time_bound = self.cleaned_data.get("lower_time_bound")
        upper_time_bound = self.cleaned_data.get("upper_time_bound")
        if (
            lower_time_bound
            and upper_time_bound
            and lower_time_bound > upper_time_bound
        ):
            raise forms.ValidationError(
                "Lower time bound must be before upper time bound."
            )
