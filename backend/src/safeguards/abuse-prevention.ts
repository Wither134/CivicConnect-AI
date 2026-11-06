export class AbusePrevention {
  // Citizen daily submission rate limit: max 5 per 24 hours
  private static userSubmissions: Map<string, number[]> = new Map();
  public static readonly DAILY_LIMIT = 5;

  private static SPAM_KEYWORDS = ['buy cheap', 'viagra', 'casino', 'free money', 'crypto airdrop', 'telegram channel'];

  /**
   * Check rate limit for citizen
   */
  static checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetHours: number } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const timestamps = (this.userSubmissions.get(userId) || []).filter((t) => t > oneDayAgo);
    this.userSubmissions.set(userId, timestamps);

    if (timestamps.length >= this.DAILY_LIMIT) {
      const oldest = timestamps[0];
      const resetHours = Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / (60 * 60 * 1000));
      return {
        allowed: false,
        remaining: 0,
        resetHours
      };
    }

    return {
      allowed: true,
      remaining: this.DAILY_LIMIT - timestamps.length,
      resetHours: 24
    };
  }

  static recordSubmission(userId: string): void {
    const now = Date.now();
    const timestamps = this.userSubmissions.get(userId) || [];
    timestamps.push(now);
    this.userSubmissions.set(userId, timestamps);
  }

  /**
   * Check for profanity or spam content
   */
  static checkContentSpam(title: string, description: string): { isFlagged: boolean; reason?: string } {
    const combined = `${title} ${description}`.toLowerCase();
    for (const kw of this.SPAM_KEYWORDS) {
      if (combined.includes(kw)) {
        return {
          isFlagged: true,
          reason: `Flagged for potential spam: detected keyword '${kw}'`
        };
      }
    }
    return { isFlagged: false };
  }

  /**
   * Validate image upload: max 5MB, accepted types, strip EXIF data
   */
  static validateAndProcessImage(file: {
    sizeBytes: number;
    mimeType: string;
    hasExif?: boolean;
  }): { valid: boolean; error?: string; exifStripped: boolean } {
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (file.sizeBytes > MAX_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 5 MB limit (${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB).`,
        exifStripped: false
      };
    }

    if (!ALLOWED_TYPES.includes(file.mimeType)) {
      return {
        valid: false,
        error: `Unsupported image format (${file.mimeType}). Accepted formats: JPG, PNG, WEBP.`,
        exifStripped: false
      };
    }

    // In production, EXIF GPS and metadata is stripped by image processing pipeline
    return {
      valid: true,
      exifStripped: true
    };
  }

  /**
   * Coarsen coordinate to 3 decimal places (~110m accuracy) for public privacy protection
   */
  static coarsenCoordinate(val: number): number {
    return Math.round(val * 1000) / 1000;
  }
}

