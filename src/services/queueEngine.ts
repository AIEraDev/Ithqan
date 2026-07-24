import { quranApi, AyahLocation } from "./quranApi";
import { retentionScheduler } from "./retentionScheduler";

export type UnitType = "ayah" | "ayah_range" | "page" | "page_range" | "surah";
export type RepeatMode = "per_ayah" | "per_page" | "per_page_chunk" | "per_block";

export interface QueueConfig {
  unitType: UnitType;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  startPage: number;
  endPage: number;
  repeatCount: number;
  interRepeatGapSeconds: number;
  autoAdvance: boolean;
  reciterId: string;
  smartRetentionOrder?: boolean;
  repeatMode?: RepeatMode;
  chunkPageSize?: number;
}

export interface QueueUnit {
  unitIndex: number;
  unitType: UnitType;
  label: string;
  ayahs: AyahLocation[];
}

export const queueEngine = {
  async buildQueue(config: QueueConfig): Promise<QueueUnit[]> {
    const units: QueueUnit[] = [];
    const mode = config.repeatMode || "per_ayah";
    const chunkSize = config.chunkPageSize || 2;

    switch (config.unitType) {
      case "ayah": {
        const page = await quranApi.getPageForAyah(
          config.surahNumber,
          config.startAyah
        );
        units.push({
          unitIndex: 0,
          unitType: "ayah",
          label: `Surah ${config.surahNumber}:${config.startAyah}`,
          ayahs: [
            {
              surah: config.surahNumber,
              ayah: config.startAyah,
              page,
              juz: 1,
            },
          ],
        });
        break;
      }

      case "ayah_range": {
        const ayahs = await quranApi.getAyahRange(
          config.surahNumber,
          config.startAyah,
          config.endAyah
        );

        if (mode === "per_ayah") {
          let uIdx = 0;
          for (const a of ayahs) {
            units.push({
              unitIndex: uIdx++,
              unitType: "ayah_range",
              label: `Surah ${a.surah}:${a.ayah}`,
              ayahs: [a],
            });
          }
        } else if (mode === "per_page" || mode === "per_page_chunk") {
          // Group ayahs by Mushaf page
          const pageMap = new Map<number, AyahLocation[]>();
          for (const a of ayahs) {
            if (!pageMap.has(a.page)) pageMap.set(a.page, []);
            pageMap.get(a.page)!.push(a);
          }

          if (mode === "per_page") {
            let uIdx = 0;
            for (const [p, pAyahs] of pageMap.entries()) {
              units.push({
                unitIndex: uIdx++,
                unitType: "ayah_range",
                label: `Page ${p} (${pAyahs.length} ayahs)`,
                ayahs: pAyahs,
              });
            }
          } else {
            // per_page_chunk
            const pages = Array.from(pageMap.keys());
            let uIdx = 0;
            for (let i = 0; i < pages.length; i += chunkSize) {
              const chunkPages = pages.slice(i, i + chunkSize);
              const chunkAyahs = chunkPages.flatMap((p) => pageMap.get(p) || []);
              const startP = chunkPages[0];
              const endP = chunkPages[chunkPages.length - 1];
              units.push({
                unitIndex: uIdx++,
                unitType: "ayah_range",
                label: startP === endP ? `Page ${startP}` : `Pages ${startP}–${endP}`,
                ayahs: chunkAyahs,
              });
            }
          }
        } else {
          // per_block
          units.push({
            unitIndex: 0,
            unitType: "ayah_range",
            label: `Surah ${config.surahNumber}:${config.startAyah}-${config.endAyah} [Full Block]`,
            ayahs,
          });
        }
        break;
      }

      case "page": {
        const ayahs = await quranApi.getAyahsForPage(config.startPage);
        const pageInfo = await quranApi.getPageInfo(config.startPage);

        if (mode === "per_ayah") {
          let uIdx = 0;
          for (const a of ayahs) {
            units.push({
              unitIndex: uIdx++,
              unitType: "page",
              label: `Page ${config.startPage} • Ayah ${a.surah}:${a.ayah}`,
              ayahs: [a],
            });
          }
        } else {
          units.push({
            unitIndex: 0,
            unitType: "page",
            label: `Page ${config.startPage} (Juz ${pageInfo.juz})`,
            ayahs,
          });
        }
        break;
      }

      case "page_range": {
        const startP = Math.min(config.startPage, config.endPage);
        const endP = Math.max(config.startPage, config.endPage);
        let rawPages: number[] = [];

        for (let p = startP; p <= endP; p++) {
          rawPages.push(p);
        }

        if (config.smartRetentionOrder) {
          rawPages = await retentionScheduler.prioritizePages(rawPages);
        }

        if (mode === "per_ayah") {
          let uIdx = 0;
          for (const p of rawPages) {
            const ayahs = await quranApi.getAyahsForPage(p);
            for (const a of ayahs) {
              units.push({
                unitIndex: uIdx++,
                unitType: "page_range",
                label: `Page ${p} • Ayah ${a.surah}:${a.ayah}`,
                ayahs: [a],
              });
            }
          }
        } else if (mode === "per_page") {
          let uIdx = 0;
          for (const p of rawPages) {
            const ayahs = await quranApi.getAyahsForPage(p);
            const pageInfo = await quranApi.getPageInfo(p);
            units.push({
              unitIndex: uIdx++,
              unitType: "page_range",
              label: `Page ${p} (Juz ${pageInfo.juz})`,
              ayahs,
            });
          }
        } else if (mode === "per_page_chunk") {
          let uIdx = 0;
          for (let i = 0; i < rawPages.length; i += chunkSize) {
            const chunkPages = rawPages.slice(i, i + chunkSize);
            const chunkAyahs: AyahLocation[] = [];
            for (const p of chunkPages) {
              const aList = await quranApi.getAyahsForPage(p);
              chunkAyahs.push(...aList);
            }
            const pStart = chunkPages[0];
            const pEnd = chunkPages[chunkPages.length - 1];
            units.push({
              unitIndex: uIdx++,
              unitType: "page_range",
              label: pStart === pEnd ? `Page ${pStart}` : `Pages ${pStart}–${pEnd}`,
              ayahs: chunkAyahs,
            });
          }
        } else {
          // per_block
          const allAyahs: AyahLocation[] = [];
          for (const p of rawPages) {
            const aList = await quranApi.getAyahsForPage(p);
            allAyahs.push(...aList);
          }
          units.push({
            unitIndex: 0,
            unitType: "page_range",
            label: `Pages ${startP}–${endP} [Full Block]`,
            ayahs: allAyahs,
          });
        }
        break;
      }

      case "surah": {
        const surah = await quranApi.getSurah(config.surahNumber);
        const ayahs = await quranApi.getAyahRange(
          config.surahNumber,
          1,
          surah.ayah_count
        );

        if (mode === "per_ayah") {
          let uIdx = 0;
          for (const a of ayahs) {
            units.push({
              unitIndex: uIdx++,
              unitType: "surah",
              label: `Surah ${surah.number}. ${surah.name_english} • Ayah ${a.ayah}`,
              ayahs: [a],
            });
          }
        } else if (mode === "per_page" || mode === "per_page_chunk") {
          // Group ayahs by Mushaf page
          const pageMap = new Map<number, AyahLocation[]>();
          for (const a of ayahs) {
            if (!pageMap.has(a.page)) pageMap.set(a.page, []);
            pageMap.get(a.page)!.push(a);
          }

          if (mode === "per_page") {
            let uIdx = 0;
            for (const [p, pAyahs] of pageMap.entries()) {
              units.push({
                unitIndex: uIdx++,
                unitType: "surah",
                label: `Surah ${surah.name_english} • Page ${p} (${pAyahs.length} ayahs)`,
                ayahs: pAyahs,
              });
            }
          } else {
            // per_page_chunk
            const pages = Array.from(pageMap.keys());
            let uIdx = 0;
            for (let i = 0; i < pages.length; i += chunkSize) {
              const chunkPages = pages.slice(i, i + chunkSize);
              const chunkAyahs = chunkPages.flatMap((p) => pageMap.get(p) || []);
              const pStart = chunkPages[0];
              const pEnd = chunkPages[chunkPages.length - 1];
              units.push({
                unitIndex: uIdx++,
                unitType: "surah",
                label:
                  pStart === pEnd
                    ? `Surah ${surah.name_english} • Page ${pStart}`
                    : `Surah ${surah.name_english} • Pages ${pStart}–${pEnd}`,
                ayahs: chunkAyahs,
              });
            }
          }
        } else {
          // per_block
          units.push({
            unitIndex: 0,
            unitType: "surah",
            label: `Surah ${surah.number}. ${surah.name_english} (${surah.name_arabic}) [Full Block]`,
            ayahs,
          });
        }
        break;
      }
    }

    return units;
  },
};
