import { useState, useEffect, useRef } from 'react';
import { neptunAlertsService, UKRAINIAN_REGIONS } from '../services/neptunAlerts';
import { useSchedule } from './useSchedule';
import { useSetScheduleOverride } from './useScheduleOverrides';
import { format } from 'date-fns';
import { isLessonNow } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import { updateAppSettings } from '../api/client';

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

  // Stable references to prevent effect teardown and reconnect thrashing on schedule refetches
  const selectedRegionRef = useRef(selectedRegion);
  selectedRegionRef.current = selectedRegion;

  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  const mutateRef = useRef(setOverrideMutation.mutate);
  mutateRef.current = setOverrideMutation.mutate;

  const tRef = useRef(t);
  tRef.current = t;

  // 1. Alert stream subscription: depends ONLY on alertsEnabled
  useEffect(() => {
    if (!alertsEnabled) {
      setIsAlertActive(false);
      setRawAlerts([]);
      return;
    }

    const unsubscribe = neptunAlertsService.subscribe((activeOblasts) => {
      setRawAlerts(activeOblasts);
      setIsAlertActive(neptunAlertsService.isRegionAlarmed(selectedRegionRef.current));
    });

    return () => {
      unsubscribe();
    };
  }, [alertsEnabled]);

  // 2. Re-evaluate alarm status when user selects a different region
  useEffect(() => {
    if (alertsEnabled) {
      setIsAlertActive(neptunAlertsService.isRegionAlarmed(selectedRegion));
    }
  }, [alertsEnabled, selectedRegion]);

  // 3. Isolated auto-cancellation: fires only when alarm becomes active during ongoing lesson hours
  useEffect(() => {
    if (!isAlertActive || !autoCancelEnabled) return;

    const curSchedule = scheduleRef.current;
    if (!curSchedule?.[0]?.lessons) return;

    for (const lesson of curSchedule[0].lessons) {
      if (
        !lesson.is_cancelled &&
        isLessonNow(lesson.start_time, lesson.end_time, todayIso)
      ) {
        mutateRef.current({
          date: todayIso,
          lesson_order: lesson.lesson_order,
          subject_id: null,
          original_subject_id: lesson.subject?.id || null,
          original_subject_name: lesson.subject?.name || null,
          is_cancelled: true,
          note: tRef.current('air_alert_lesson_note'),
          event_type: lesson.event_type || null,
        });
      }
    }
  }, [isAlertActive, autoCancelEnabled, todayIso]);

  const updateAlertsEnabled = (val: boolean) => {
    setAlertsEnabled(val);
    localStorage.setItem('air_alerts_enabled', val ? 'true' : 'false');
    updateAppSettings({ air_alerts_enabled: val }).catch(console.error);
  };

  const updateSelectedRegion = (regionId: string) => {
    setSelectedRegion(regionId);
    localStorage.setItem('air_alerts_region', regionId);
    updateAppSettings({ air_alerts_region: regionId }).catch(console.error);
  };

  const updateAutoCancel = (val: boolean) => {
    setAutoCancelEnabled(val);
    localStorage.setItem('air_alerts_auto_cancel', val ? 'true' : 'false');
    updateAppSettings({ air_alerts_auto_cancel: val }).catch(console.error);
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
