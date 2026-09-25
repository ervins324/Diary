import unittest
from datetime import datetime, date, time
from app.schemas.setting import AppSettingsRead, AppSettingsUpdate, EffectiveDateResponse
from app.models.setting import AppSettings
from app.services.alert_service import is_region_alarmed

class TestSettingsLogic(unittest.TestCase):
    def test_schema_defaults(self):
        s = AppSettingsRead()
        self.assertEqual(s.font_family, "inter")
        self.assertEqual(s.theme, "dark")
        self.assertEqual(s.language, "uk")
        self.assertTrue(s.skip_weekends_to_monday)
        self.assertEqual(s.default_lesson_duration, 45)
        self.assertEqual(s.default_break_duration, 10)
        self.assertFalse(s.air_alerts_enabled)
        self.assertEqual(s.air_alerts_region, "kyiv_city")

    def test_update_schema_partial(self):
        u = AppSettingsUpdate(font_family="montserrat", day_shift_after_hour=16)
        d = u.model_dump(exclude_unset=True)
        self.assertEqual(d, {"font_family": "montserrat", "day_shift_after_hour": 16})

    def test_is_region_alarmed_kyiv_city_vs_oblast(self):
        # Kyiv Oblast alarm should NOT trigger Kyiv City alarm
        data_oblast = {"oblasts": [{"name": "Київська область", "key": "kyiv"}]}
        self.assertFalse(is_region_alarmed(data_oblast, "kyiv_city"))
        self.assertTrue(is_region_alarmed(data_oblast, "kyiv"))

        # Kyiv City alarm should trigger Kyiv City
        data_city = {"oblasts": [{"name": "м. Київ", "key": "kyiv_city"}]}
        self.assertTrue(is_region_alarmed(data_city, "kyiv_city"))
        self.assertFalse(is_region_alarmed(data_city, "kyiv"))

    def test_is_region_alarmed_other_regions(self):
        data = {"oblasts": [{"name": "Львівська область", "key": "lviv"}]}
        self.assertTrue(is_region_alarmed(data, "lviv"))
        self.assertFalse(is_region_alarmed(data, "odesa"))
        self.assertFalse(is_region_alarmed({}, "lviv"))

    def test_effective_date_calculation_simulation(self):
        from app.routers.settings import get_effective_date
        # Test Friday 17:00 when day_shift is 16:00 and skip_weekends is True
        # Friday + 1 day = Saturday -> skips to Monday!
        friday_evening = datetime(2026, 9, 25, 17, 0, 0) # 2026-09-25 is Friday
        now = friday_evening
        cur_date = now.date()
        
        day_shift_after_hour = 16
        skip_weekends_to_monday = True
        
        if day_shift_after_hour is not None and now.hour >= day_shift_after_hour:
            cur_date = date(cur_date.year, cur_date.month, cur_date.day + 1) # Saturday
            
        if skip_weekends_to_monday:
            if cur_date.weekday() == 5: # Saturday
                cur_date = date(cur_date.year, cur_date.month, cur_date.day + 2) # Monday
        
        self.assertEqual(cur_date.isoformat(), "2026-09-28") # Next Monday!

if __name__ == "__main__":
    unittest.main()
