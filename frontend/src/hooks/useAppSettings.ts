import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAppSettings, updateAppSettings, resetAppSettings } from '../api/client';
import type { AppSettings } from '../types';
import {
  setCachedLocalStorage,
  setFontFamily,
  setShowCabinetsEnabled,
  setSkipWeekendsEnabled,
  setDayShiftAfterHour,
  setHwIconSize,
  setDefaultLessonDuration,
  setDefaultBreakDuration,
} from '../lib/storage';

/**
 * React Query hook to fetch centralized backend application settings.
 * Synchronizes backend settings into memory cache and DOM attributes.
 */
export function useAppSettings() {
  return useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const data = await fetchAppSettings();
      // Synchronize backend settings to fast local cache
      if (data.font_family) {
        setFontFamily(data.font_family);
      }
      if (typeof data.show_cabinets === 'boolean') {
        setShowCabinetsEnabled(data.show_cabinets);
      }
      if (typeof data.skip_weekends_to_monday === 'boolean') {
        setSkipWeekendsEnabled(data.skip_weekends_to_monday);
      }
      if (data.day_shift_after_hour !== undefined) {
        setDayShiftAfterHour(data.day_shift_after_hour);
      }
      if (data.hw_icon_size) {
        setHwIconSize(data.hw_icon_size);
      }
      if (data.default_lesson_duration) {
        setDefaultLessonDuration(data.default_lesson_duration);
      }
      if (data.default_break_duration) {
        setDefaultBreakDuration(data.default_break_duration);
      }
      if (typeof data.live_widget_enabled === 'boolean') {
        setCachedLocalStorage('live_widget_enabled', data.live_widget_enabled ? 'true' : 'false');
      }
      if (typeof data.live_widget_show_lesson === 'boolean') {
        setCachedLocalStorage('live_widget_show_lesson', data.live_widget_show_lesson ? 'true' : 'false');
      }
      if (typeof data.live_widget_show_homework === 'boolean') {
        setCachedLocalStorage('live_widget_show_homework', data.live_widget_show_homework ? 'true' : 'false');
      }
      if (typeof data.live_widget_show_events === 'boolean') {
        setCachedLocalStorage('live_widget_show_events', data.live_widget_show_events ? 'true' : 'false');
      }
      if (typeof data.air_alerts_enabled === 'boolean') {
        setCachedLocalStorage('air_alerts_enabled', data.air_alerts_enabled ? 'true' : 'false');
      }
      if (data.air_alerts_region) {
        setCachedLocalStorage('air_alerts_region', data.air_alerts_region);
      }
      if (typeof data.air_alerts_auto_cancel === 'boolean') {
        setCachedLocalStorage('air_alerts_auto_cancel', data.air_alerts_auto_cancel ? 'true' : 'false');
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * React Query mutation hook to update application settings on the backend.
 * Provides optimistic updates and local disk/memory cache synchronization.
 */
export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newSettings: Partial<AppSettings>) => updateAppSettings(newSettings),
    onMutate: async (newSettings: Partial<AppSettings>) => {
      // Cancel ongoing queries to avoid overwriting optimistic updates
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previousSettings = queryClient.getQueryData<AppSettings>(['settings']);

      // Optimistically update React Query cache
      if (previousSettings) {
        queryClient.setQueryData<AppSettings>(['settings'], {
          ...previousSettings,
          ...newSettings,
        });
      }

      // Synchronize optimistic values to local storage cache immediately
      if (newSettings.font_family) {
        setFontFamily(newSettings.font_family);
      }
      if (typeof newSettings.show_cabinets === 'boolean') {
        setShowCabinetsEnabled(newSettings.show_cabinets);
      }
      if (typeof newSettings.skip_weekends_to_monday === 'boolean') {
        setSkipWeekendsEnabled(newSettings.skip_weekends_to_monday);
      }
      if (newSettings.day_shift_after_hour !== undefined) {
        setDayShiftAfterHour(newSettings.day_shift_after_hour);
      }
      if (newSettings.hw_icon_size) {
        setHwIconSize(newSettings.hw_icon_size);
      }
      if (newSettings.default_lesson_duration) {
        setDefaultLessonDuration(newSettings.default_lesson_duration);
      }
      if (newSettings.default_break_duration) {
        setDefaultBreakDuration(newSettings.default_break_duration);
      }
      if (typeof newSettings.live_widget_enabled === 'boolean') {
        setCachedLocalStorage('live_widget_enabled', newSettings.live_widget_enabled ? 'true' : 'false');
      }
      if (typeof newSettings.live_widget_show_lesson === 'boolean') {
        setCachedLocalStorage('live_widget_show_lesson', newSettings.live_widget_show_lesson ? 'true' : 'false');
      }
      if (typeof newSettings.live_widget_show_homework === 'boolean') {
        setCachedLocalStorage('live_widget_show_homework', newSettings.live_widget_show_homework ? 'true' : 'false');
      }
      if (typeof newSettings.live_widget_show_events === 'boolean') {
        setCachedLocalStorage('live_widget_show_events', newSettings.live_widget_show_events ? 'true' : 'false');
      }
      if (typeof newSettings.air_alerts_enabled === 'boolean') {
        setCachedLocalStorage('air_alerts_enabled', newSettings.air_alerts_enabled ? 'true' : 'false');
      }
      if (newSettings.air_alerts_region) {
        setCachedLocalStorage('air_alerts_region', newSettings.air_alerts_region);
      }
      if (typeof newSettings.air_alerts_auto_cancel === 'boolean') {
        setCachedLocalStorage('air_alerts_auto_cancel', newSettings.air_alerts_auto_cancel ? 'true' : 'false');
      }

      return { previousSettings };
    },
    onError: (_err, _newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Invalidate schedule and stats queries if date shifts or weekend preferences changed
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

/**
 * Mutation to reset settings to defaults.
 */
export function useResetAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => resetAppSettings(),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      setFontFamily(data.font_family);
      setShowCabinetsEnabled(data.show_cabinets);
      setSkipWeekendsEnabled(data.skip_weekends_to_monday);
      setDayShiftAfterHour(data.day_shift_after_hour);
      setHwIconSize(data.hw_icon_size);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}
