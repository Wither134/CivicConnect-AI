"""
Rule-Based Municipal Action Recommendation Engine.

Provides transparent, actionable decision-support steps tailored to
the complaint's category, priority level, and specific risk keywords.
Operates deterministically and locally without external dependencies.
"""

from typing import Optional


# Category-specific standard operating procedures (SOPs)
RECOMMENDATIONS_MAP = {
    "Roads & potholes": [
        "Deploy a road inspection crew to assess pothole dimensions and traffic safety risk.",
        "Place warning cones or temporary barricades if depth exceeds 50 mm.",
        "Schedule rapid cold-mix asphalt patching within the active shift.",
        "Inspect surrounding sub-base for subterranean water infiltration.",
    ],
    "Street lighting": [
        "Dispatch electrical crew to test feeder pillar and circuit breakers.",
        "Inspect luminaire fitting, photocell sensor, and wiring integrity.",
        "Check adjacent lighting poles for cascaded circuit tripping.",
        "Confirm nighttime restoration with the area ward supervisor.",
    ],
    "Water supply": [
        "Isolate nearest control valve if an active pipeline burst or heavy leak is detected.",
        "Collect water samples for residual chlorine and turbidity testing if contamination is reported.",
        "Deploy municipal water tanker to supply affected residents during repair downtime.",
        "Log repair timeline with the municipal water works engineering division.",
    ],
    "Drainage & flooding": [
        "Dispatch super-sucker jetting machine to clear storm drain obstructions.",
        "Inspect culvert and discharge outfall to ensure free gravity flow.",
        "Deploy portable de-watering pumps if surface water depth exceeds 15 cm.",
        "Inspect and secure missing or damaged manhole covers immediately to prevent accidents.",
    ],
    "Waste collection": [
        "Dispatch mechanical sweeper and tipper truck to clear accumulated garbage pile.",
        "Sanitize and apply lime powder/disinfectant to prevent disease vector breeding.",
        "Inspect site for illegal commercial debris dumping and issue notice if applicable.",
        "Evaluate permanent community dustbin placement if this location is a chronic blackspot.",
    ],
    "Parks & public spaces": [
        "Cordon off broken park benches or damaged children's play equipment.",
        "Schedule horticultural team for tree branch trimming and pathway clearance.",
        "Inspect perimeter fencing and garden lighting fixtures for public safety.",
    ],
    "Noise": [
        "Dispatch municipal enforcement/patrol to measure ambient decibel levels.",
        "Verify if commercial generator or construction has valid permission/silent enclosures.",
        "Issue warning or stop-work notice if operating beyond permitted 10:00 PM curfew.",
    ],
    "Other": [
        "Assign field inspector for on-site physical verification within 24 hours.",
        "Categorize specific civic domain and route to appropriate municipal department.",
        "Log preliminary site observation notes into the dispatch register.",
    ],
}

# Priority-based operational urgency escalations
PRIORITY_ADDITIONS = {
    "Critical": [
        "EMERGENCY DISPATCH: Alert ward executive engineer for immediate supervisor sign-off.",
        "Notify traffic police and civic emergency desk if arterial transit is obstructed.",
    ],
    "High": [
        "Expedite crew dispatch within 4 hours under high-priority service level agreement.",
    ],
    "Medium": [
        "Schedule maintenance within regular 24-48 hour municipal resolution window.",
    ],
    "Low": [
        "Group with routine weekly ward maintenance schedule.",
    ],
}


CATEGORY_ALIASES = {
    "pothole": "Roads & potholes",
    "road": "Roads & potholes",
    "asphalt": "Roads & potholes",
    "traffic": "Roads & potholes",
    "street light": "Street lighting",
    "streetlight": "Street lighting",
    "lighting": "Street lighting",
    "lamp": "Street lighting",
    "dark": "Street lighting",
    "drain": "Drainage & flooding",
    "flood": "Drainage & flooding",
    "waterlog": "Drainage & flooding",
    "gutter": "Drainage & flooding",
    "manhole": "Drainage & flooding",
    "garbage": "Waste collection",
    "waste": "Waste collection",
    "trash": "Waste collection",
    "debris": "Waste collection",
    "water": "Water supply",
    "leak": "Water supply",
    "pipe": "Water supply",
    "park": "Parks & public spaces",
    "tree": "Parks & public spaces",
    "noise": "Noise",
}


def get_recommended_actions(
    category: Optional[str], priority_level: str, title: str, description: str
) -> list[str]:
    """
    Generate tailored next-step recommendations based on category and priority.
    Returns 3–4 transparent, practical municipal steps.
    """
    cat_key = "Other"
    search_text = f"{category or ''} {title} {description}".lower()

    if category and category in RECOMMENDATIONS_MAP:
        cat_key = category
    else:
        for alias, mapped_cat in CATEGORY_ALIASES.items():
            if alias in search_text:
                cat_key = mapped_cat
                break

    base_actions = RECOMMENDATIONS_MAP.get(cat_key, RECOMMENDATIONS_MAP["Other"])

    # Pick top 2 base recommendations
    actions = list(base_actions[:2])

    # Add specific priority escalation
    priority_notes = PRIORITY_ADDITIONS.get(priority_level, [])
    if priority_notes:
        actions.insert(0, priority_notes[0])

    # Add 1 more category action if space permits
    if len(actions) < 3 and len(base_actions) > 2:
        actions.append(base_actions[2])

    return actions
