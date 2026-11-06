"""
Local Civic Complaint Text Classifier.

Uses a scikit-learn TF-IDF + Multinomial Naive Bayes pipeline trained on a
curated corpus of municipal civic complaints, backed by transparent keyword-matching
fallback heuristics. Runs entirely offline with zero external APIs.
"""

from dataclasses import dataclass
import re
from typing import Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

# Curated reference training corpus across core municipal complaint categories
TRAINING_DATA = [
    # Roads & potholes
    ("pothole on main road", "Roads & potholes"),
    ("deep crater on asphalt damaging car tires", "Roads & potholes"),
    ("road surface peeling off near junction", "Roads & potholes"),
    ("unpaved road full of stones and trenches", "Roads & potholes"),
    ("speed breaker unmarked and causing bike accidents", "Roads & potholes"),
    ("tar road damaged after pipeline work", "Roads & potholes"),
    ("dangerous pothole near bus stop", "Roads & potholes"),
    ("sinkhole opening up on roadway lane", "Roads & potholes"),
    ("cracked pavement and uneven road surface", "Roads & potholes"),
    
    # Street lighting
    ("broken streetlight on main street", "Street lighting"),
    ("street lamps not working for three days dark road", "Street lighting"),
    ("flickering street light pole making buzzing sound", "Street lighting"),
    ("dark stretch near school need street lighting", "Street lighting"),
    ("lamp post knocked down by vehicle wires exposed", "Street lighting"),
    ("bulb fused on 5th cross street light", "Street lighting"),
    ("streetlights remain off all night hazard for pedestrians", "Street lighting"),
    ("damaged lighting fixture on avenue", "Street lighting"),
    
    # Water supply
    ("no drinking water supply in area for two days", "Water supply"),
    ("low water pressure from municipal connection", "Water supply"),
    ("drinking water pipeline burst water leaking on road", "Water supply"),
    ("contaminated muddy water coming from municipal tap", "Water supply"),
    ("valve leak wasting thousands of liters of clean water", "Water supply"),
    ("erratic water supply schedule in ward", "Water supply"),
    ("underground water pipe rupture flooding street", "Water supply"),
    ("drinking water smells bad foul odor", "Water supply"),
    
    # Drainage & flooding
    ("blocked drain overflowing onto sidewalk and street", "Drainage & flooding"),
    ("severe waterlogging near main road after rain", "Drainage & flooding"),
    ("stormwater drain clogged with debris and silt", "Drainage & flooding"),
    ("open manhole gutter overflowing with sewage water", "Drainage & flooding"),
    ("flooding under railway bridge water stagnating", "Drainage & flooding"),
    ("sewage line backed up into residential lane", "Drainage & flooding"),
    ("rainwater cannot drain storm drain choked", "Drainage & flooding"),
    ("waterlogged intersection causing heavy traffic jam", "Drainage & flooding"),
    ("culvert blocked water entering nearby shops", "Drainage & flooding"),
    
    # Waste collection
    ("garbage pile dumped on corner not collected for a week", "Waste collection"),
    ("overflowing trash bin smelling terrible on street", "Waste collection"),
    ("waste collection vehicle has not visited ward", "Waste collection"),
    ("illegal debris dumping and construction waste on footpath", "Waste collection"),
    ("stray animals scattering plastic and food waste", "Waste collection"),
    ("rotting garbage creating health hazard", "Waste collection"),
    ("blackspot garbage dump near public park", "Waste collection"),
    ("sweeper not sweeping neighborhood road", "Waste collection"),
    
    # Parks & public spaces
    ("broken park bench and damaged play equipment for kids", "Parks & public spaces"),
    ("overgrown grass and fallen tree branches blocking park path", "Parks & public spaces"),
    ("park lights damaged and gate broken", "Parks & public spaces"),
    ("public playground littered with glass bottles", "Parks & public spaces"),
    ("dry tree branch about to fall on pedestrian walkway", "Parks & public spaces"),
    ("encroachment on public garden space", "Parks & public spaces"),
    ("open gym equipment broken and unsafe", "Parks & public spaces"),
    
    # Noise
    ("loud construction noise late at night after 10 pm", "Noise"),
    ("commercial generator creating excessive vibration and noise", "Noise"),
    ("loudspeakers playing throughout the night without permission", "Noise"),
    ("industrial machinery making loud unbearable noise in residential area", "Noise"),
    ("continuous vehicle honking and illegal modified silencer noise", "Noise"),
]

# Explicit keyword fallback dictionary
CATEGORY_KEYWORDS = {
    "Roads & potholes": ["pothole", "crater", "asphalt", "tar", "speed breaker", "road surface", "trench", "sinkhole", "pavement"],
    "Street lighting": ["streetlight", "street light", "streetlamp", "lamp post", "bulb fused", "lighting", "dark road", "fixture", "flickering"],
    "Water supply": ["water supply", "drinking water", "tap water", "water pipe", "pipeline burst", "clean water", "water pressure", "water leak"],
    "Drainage & flooding": ["waterlogging", "waterlogged", "drain", "drainage", "flood", "flooding", "manhole", "sewage", "gutter", "culvert", "stormwater", "overflowing"],
    "Waste collection": ["garbage", "trash", "waste", "dump", "debris", "litter", "rubbish", "refuse", "bin", "sweeper", "blackspot"],
    "Parks & public spaces": ["park", "garden", "playground", "bench", "tree branch", "lawn", "public space", "play area"],
    "Noise": ["noise", "loudspeaker", "generator", "decibel", "sound", "honking", "loud music"],
}


@dataclass
class ClassificationResult:
    predicted_category: str
    confidence: float
    method: str  # 'ml_model' | 'keyword_rule' | 'fallback'
    matched_keywords: list[str]
    is_agreement: bool  # Whether it agrees with citizen-selected category


class ComplaintClassifier:
    """Singleton-style cached classifier model."""

    def __init__(self):
        self._pipeline: Optional[Pipeline] = None
        self._is_trained = False
        self._train()

    def _train(self):
        """Train the local TF-IDF + Naive Bayes pipeline on startup."""
        try:
            texts = [t[0] for t in TRAINING_DATA]
            labels = [t[1] for t in TRAINING_DATA]
            
            self._pipeline = Pipeline([
                ("tfidf", TfidfVectorizer(
                    ngram_range=(1, 2),
                    stop_words="english",
                    sublinear_tf=True,
                    min_df=1,
                )),
                ("nb", MultinomialNB(alpha=0.1)),
            ])
            self._pipeline.fit(texts, labels)
            self._is_trained = True
        except Exception:
            self._is_trained = False

    def classify(self, title: str, description: str, citizen_category: Optional[str] = None) -> ClassificationResult:
        """Classify a complaint title and description."""
        combined_text = f"{title} {description}".strip().lower()
        
        # 1. Check keyword rules first for exact semantic anchors
        matched_category = None
        matched_kw_list = []
        highest_kw_count = 0
        
        for category, keywords in CATEGORY_KEYWORDS.items():
            found = [kw for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", combined_text)]
            if len(found) > highest_kw_count:
                highest_kw_count = len(found)
                matched_category = category
                matched_kw_list = found

        # 2. Query trained scikit-learn model
        ml_category = None
        ml_confidence = 0.0
        
        if self._is_trained and self._pipeline and len(combined_text) > 3:
            try:
                probs = self._pipeline.predict_proba([combined_text])[0]
                classes = self._pipeline.classes_
                max_idx = probs.argmax()
                ml_category = classes[max_idx]
                ml_confidence = float(probs[max_idx])
            except Exception:
                ml_category = None
                ml_confidence = 0.0

        # 3. Combine signals: if keywords strongly point to a category, prioritize or reinforce
        if highest_kw_count >= 1 and matched_category:
            final_category = matched_category
            confidence = min(0.95, 0.70 + (0.10 * highest_kw_count))
            method = "keyword_rule"
            if ml_category == matched_category and ml_confidence > 0.4:
                confidence = max(confidence, ml_confidence)
                method = "ml_model + keyword_rule"
        elif ml_category and ml_confidence >= 0.35:
            final_category = ml_category
            confidence = round(ml_confidence, 2)
            method = "ml_model"
        else:
            final_category = citizen_category or "Other"
            confidence = 0.30
            method = "fallback"

        # Check agreement with citizen-selected category
        is_agreement = False
        if citizen_category:
            c_clean = citizen_category.lower().replace("&", "").strip()
            p_clean = final_category.lower().replace("&", "").strip()
            is_agreement = c_clean in p_clean or p_clean in c_clean

        return ClassificationResult(
            predicted_category=final_category,
            confidence=round(confidence, 2),
            method=method,
            matched_keywords=matched_kw_list,
            is_agreement=is_agreement,
        )


# Global cached classifier instance
_classifier_instance: Optional[ComplaintClassifier] = None


def get_classifier() -> ComplaintClassifier:
    """Retrieve the shared ComplaintClassifier instance."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = ComplaintClassifier()
    return _classifier_instance
