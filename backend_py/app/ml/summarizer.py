"""
Local Extractive Complaint Summarizer.

Extracts the most salient factual sentences from complaint descriptions
using local statistical and sentence-salience scoring. Completely offline,
zero hallucination, zero generative text.
"""

import re
from typing import Optional


# Common words to filter out during scoring
STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "while", "at", "by", "for", "with",
    "about", "against", "between", "into", "through", "during", "before", "after",
    "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when", "where",
    "why", "how", "all", "any", "both", "each", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "s", "t", "can", "will", "just", "don", "should", "now", "i", "we", "my",
    "our", "me", "us", "is", "am", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did", "doing", "please", "kindly"
}


def split_sentences(text: str) -> list[str]:
    """Split text into individual clean sentences."""
    raw_sentences = re.split(r"(?<=[.!?\n])\s+", text.strip())
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 5]
    return sentences if sentences else [text.strip()]


def extract_keywords(text: str) -> set[str]:
    """Extract lowercased content words."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    return {w for w in words if w not in STOPWORDS}


def generate_extractive_summary(
    title: str, description: str, max_sentences: int = 2
) -> str:
    """
    Extract the most informative factual sentence(s) from a complaint.
    Scores sentences based on length, title overlap, and civic term frequency.
    """
    desc = description.strip()
    if not desc:
        return title.strip()

    sentences = split_sentences(desc)
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    title_words = extract_keywords(title)
    all_desc_words = extract_keywords(desc)

    # Word frequencies across the whole description
    word_freq: dict[str, int] = {}
    for w in re.findall(r"\b[a-zA-Z]{3,}\b", desc.lower()):
        if w not in STOPWORDS:
            word_freq[w] = word_freq.get(w, 0) + 1

    scored_sentences: list[tuple[float, int, str]] = []

    for idx, sentence in enumerate(sentences):
        sent_words = extract_keywords(sentence)
        if not sent_words:
            continue

        # 1. Frequency score: sum of frequencies of content words in this sentence
        freq_score = sum(word_freq.get(w, 1) for w in sent_words) / len(sent_words)

        # 2. Title overlap: rewards sentences mentioning key concepts from the title
        title_overlap = len(sent_words.intersection(title_words)) * 2.5

        # 3. Position bias: the first sentence is often the most direct summary in citizen complaints
        position_bonus = 2.0 if idx == 0 else (1.0 if idx == 1 else 0.0)

        # 4. Length penalty: penalize very short (< 15 chars) or excessively long (> 200 chars) sentences
        length = len(sentence)
        length_factor = 1.0
        if length < 20:
            length_factor = 0.5
        elif length > 180:
            length_factor = 0.8

        total_score = (freq_score + title_overlap + position_bonus) * length_factor
        scored_sentences.append((total_score, idx, sentence))

    if not scored_sentences:
        return sentences[0]

    # Pick top sentences while preserving chronological reading order
    scored_sentences.sort(key=lambda x: x[0], reverse=True)
    top_picks = scored_sentences[:max_sentences]
    top_picks.sort(key=lambda x: x[1])  # Reorder by original appearance

    summary_text = " ".join(p[2] for p in top_picks)

    # Clean up whitespace and ensure proper trailing punctuation
    summary_text = re.sub(r"\s+", " ", summary_text).strip()
    if not summary_text.endswith((".", "!", "?")):
        summary_text += "."

    return summary_text
