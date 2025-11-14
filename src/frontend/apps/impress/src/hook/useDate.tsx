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
  const { i18n ,t } = useTranslation();

  const formatDate = (
    date: string,
    format: DateTimeFormatOptions = formatDefault,
  ): string => {
    return DateTime.fromISO(date)
      .setLocale(i18n.language)
      .toLocaleString(format);
  };

  const relativeDate = (date: string): string => {
    const dateTime = DateTime.fromISO(date).setLocale(i18n.language);
    const relative = dateTime.toRelative();
    if (relative) {
      const diffInSeconds = Math.abs(dateTime.diffNow('seconds').seconds);
      if (diffInSeconds < 1) {
        return t('just now');
      }
      if (relative.includes('0 seconds') || relative.includes('0 second') ||
        relative.match(/0\s*(second|seconde|segundo|秒)/i)) {
        return t('just now');
      }
    }
    return relative;
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
