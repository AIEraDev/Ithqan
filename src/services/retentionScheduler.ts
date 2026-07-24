import { quranApi, PageReview } from "./quranApi";

export interface RetentionStats {
  totalPagesCovered: number;
  duePagesCount: number;
  coveragePercentage: number;
  juzBreakdown: { juz: number; totalPages: number; coveredPages: number }[];
}

export const retentionScheduler = {
  async getReviewMap(): Promise<Map<number, PageReview>> {
    const reviews = await quranApi.getAllPageReviews().catch(() => []);
    const map = new Map<number, PageReview>();
    for (const r of reviews) {
      map.set(r.page, r);
    }
    return map;
  },

  calculatePagePriority(
    page: number,
    reviewMap: Map<number, PageReview>,
    nowSecs: number
  ): number {
    const r = reviewMap.get(page);
    if (!r || r.last_reviewed_at === 0) {
      // Unreviewed page gets high priority
      return 10000 + (605 - page) / 100;
    }

    const daysElapsed = (nowSecs - r.last_reviewed_at) / 86400;
    const reviewFactor = Math.sqrt(Math.max(1, r.review_count));
    return (daysElapsed * 10) / reviewFactor;
  },

  async prioritizePages(pages: number[]): Promise<number[]> {
    const map = await this.getReviewMap();
    const now = Math.floor(Date.now() / 1000);

    const scored = pages.map((page) => ({
      page,
      priority: this.calculatePagePriority(page, map, now),
    }));

    scored.sort((a, b) => b.priority - a.priority);
    return scored.map((s) => s.page);
  },

  async getRetentionStats(): Promise<RetentionStats> {
    const map = await this.getReviewMap();
    const now = Math.floor(Date.now() / 1000);

    let totalPagesCovered = 0;
    let duePagesCount = 0;

    for (let p = 1; p <= 604; p++) {
      const r = map.get(p);
      if (r && r.review_count > 0) {
        totalPagesCovered++;
        const daysElapsed = (now - r.last_reviewed_at) / 86400;
        if (daysElapsed > 10) {
          duePagesCount++;
        }
      } else {
        duePagesCount++;
      }
    }

    const coveragePercentage = (totalPagesCovered / 604) * 100;

    // Juz breakdown calculation
    // Juz 1..30 roughly ~20 pages per juz
    const juzBreakdown: { juz: number; totalPages: number; coveredPages: number }[] = [];
    for (let j = 1; j <= 30; j++) {
      // Juz page ranges approximation: Juz 1: 1-21, Juz 30: 582-604
      const startP = j === 1 ? 1 : (j - 1) * 20 + 2;
      const endP = j === 30 ? 604 : j * 20 + 1;
      let covered = 0;
      let total = 0;

      for (let p = startP; p <= endP; p++) {
        total++;
        if (map.has(p) && map.get(p)!.review_count > 0) {
          covered++;
        }
      }

      juzBreakdown.push({
        juz: j,
        totalPages: total,
        coveredPages: covered,
      });
    }

    return {
      totalPagesCovered,
      duePagesCount,
      coveragePercentage,
      juzBreakdown,
    };
  },
};
