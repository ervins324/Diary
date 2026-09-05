from datetime import date

def get_week_type(target_date: date, anchor_date: date) -> str:
    """
    Calculate the week type ('numerator' or 'denominator') based on the ISO week difference
    between the target date and the anchor date.
    
    Even offset = 'numerator'
    Odd offset = 'denominator'
    """
    # Get ISO calendar (year, week, day)
    target_iso = target_date.isocalendar()
    anchor_iso = anchor_date.isocalendar()
    
    # Calculate difference in weeks
    # Approximation: using total days / 7 to find absolute week diff is safer across years
    days_diff = (target_date - anchor_date).days
    # But to align perfectly with ISO weeks, compute difference in Monday-based weeks
    
    # Alternatively, just use the iso year and week
    # Note: A proper way is (target_date - anchor_date) adjusting for weekday of anchor
    # Let's find the Monday of both dates to find true week boundaries
    target_monday = target_date.toordinal() - target_date.weekday()
    anchor_monday = anchor_date.toordinal() - anchor_date.weekday()
    
    weeks_diff = (target_monday - anchor_monday) // 7
    
    if weeks_diff % 2 == 0:
        return "numerator"
    else:
        return "denominator"
