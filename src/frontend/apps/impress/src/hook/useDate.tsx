import { DateTime, DateTimeFormatOptions } from 'luxon';
import { useTranslation } from 'react-i18next';

const formatDefault: DateTimeFormatOptions = {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export const useDate = () => {
  const { i18n } = useTranslation();

  const formatDate = (
    date: string,
    format: DateTimeFormatOptions = formatDefault,
  ): string => {
    return DateTime.fromISO(date)
      .setLocale(i18n.language)
      .toLocaleString(format);
  };

  const relativeDate = (date: string): string => {
    return DateTime.fromISO(date).setLocale(i18n.language).toRelative() || '';
  };

  const calculateDaysLeft = (date: string, daysLimit: number): number =>
    Math.max(
      0,
      Math.ceil(
        DateTime.fromISO(date).plus({ days: daysLimit }).diffNow('days').days,
      ),
    );

  return { formatDate, relativeDate, calculateDaysLeft };
};
