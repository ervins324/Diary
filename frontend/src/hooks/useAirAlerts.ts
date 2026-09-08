import { useState, useEffect } from 'react';
import { neptunAlertsService, UKRAINIAN_REGIONS } from '../services/neptunAlerts';
import { useSchedule } from './useSchedule';
import { useSetScheduleOverride } from './useScheduleOverrides';
import { format } from 'date-fns';
import { isLessonNow } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';

export function useAirAlerts() {
  const { t } = useLanguage();
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('air_alerts_enabled') === 'true';
  });

  const [selectedRegion, setSelectedRegion] = useState<string>(() => {
    return localStorage.getItem('air_alerts_region') || 'kyiv_city';
  });

  const [autoCancelEnabled, setAutoCancelEnabled] = useState<boolean>(() => {
    return localStorage.getItem('air_alerts_auto_cancel') === 'true';
  });

  const [isAlertActive, setIsAlertActive] = useState<boolean>(false);
  const [rawAlerts, setRawAlerts] = useState<string[]>([]);

  // Fetch today's schedule to evaluate ongoing lessons for auto-cancellation
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const { data: schedule } = useSchedule(todayIso, todayIso);
  const setOverrideMutation = useSetScheduleOverride();

  useEffect(() => {
    if (!alertsEnabled) {
      setIsAlertActive(false);
      return;
    }

    const unsubscribe = neptunAlertsService.subscribe((activeOblasts) => {
      setRawAlerts(activeOblasts);
      const active = neptunAlertsService.isRegionAlarmed(selectedRegion);
      setIsAlertActive(active);

      // If alert is active, auto-cancel enabled, and there's a currently ongoing lesson, auto-cancel it
      if (active && autoCancelEnabled && schedule?.[0]?.lessons) {
        for (const lesson of schedule[0].lessons) {
          if (
            !lesson.is_cancelled &&
            isLessonNow(lesson.start_time, lesson.end_time, todayIso)
          ) {
            setOverrideMutation.mutate({
              date: todayIso,
              lesson_order: lesson.lesson_order,
              subject_id: null,
              original_subject_id: lesson.subject?.id || null,
              original_subject_name: lesson.subject?.name || null,
              is_cancelled: true,
              note: t('air_alert_lesson_note'),
              event_type: lesson.event_type || null,
            });
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [alertsEnabled, selectedRegion, autoCancelEnabled, schedule, todayIso, setOverrideMutation, t]);

  const updateAlertsEnabled = (val: boolean) => {
    setAlertsEnabled(val);
    localStorage.setItem('air_alerts_enabled', val ? 'true' : 'false');
  };

  const updateSelectedRegion = (regionId: string) => {
    setSelectedRegion(regionId);
    localStorage.setItem('air_alerts_region', regionId);
  };

  const updateAutoCancel = (val: boolean) => {
    setAutoCancelEnabled(val);
    localStorage.setItem('air_alerts_auto_cancel', val ? 'true' : 'false');
  };

  return {
    alertsEnabled,
    setAlertsEnabled: updateAlertsEnabled,
    selectedRegion,
    setSelectedRegion: updateSelectedRegion,
    autoCancelEnabled,
    setAutoCancelEnabled: updateAutoCancel,
    isAlertActive,
    regions: UKRAINIAN_REGIONS,
    rawAlerts,
  };
}
