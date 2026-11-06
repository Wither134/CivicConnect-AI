export interface DuplicateCandidate {
  reportId: string;
  referenceNumber: string;
  title: string;
  category: string;
  distanceMeters: number;
  similarityScore: number;
  snippet: string;
}

export class DuplicateDetector {
  /**
   * Calculate Haversine distance in meters between two coordinates (PostGIS ST_Distance equivalent)
   */
  static haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  /**
   * Find nearby advisory duplicates before citizen submits
   */
  static findNearbySimilar(
    lat: number,
    lng: number,
    categoryName: string,
    existingReports: Array<{
      id: string;
      referenceNumber: string;
      title: string;
      categoryName: string;
      lat?: number;
      lng?: number;
      status: string;
    }>,
    radiusMeters: number = 150
  ): DuplicateCandidate[] {
    const results: DuplicateCandidate[] = [];

    for (const r of existingReports) {
      if (!r.lat || !r.lng || r.status === 'resolved' || r.status === 'rejected') continue;

      const dist = this.haversineDistanceMeters(lat, lng, r.lat, r.lng);
      if (dist <= radiusMeters) {
        let score = 50;
        if (r.categoryName.toLowerCase() === categoryName.toLowerCase()) {
          score += 40;
        }
        results.push({
          reportId: r.id,
          referenceNumber: r.referenceNumber,
          title: r.title,
          category: r.categoryName,
          distanceMeters: dist,
          similarityScore: score,
          snippet: `Similar report ${dist} m away. ${r.title}`
        });
      }
    }

    return results.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}

