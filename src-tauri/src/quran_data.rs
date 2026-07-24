use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

static METADATA: OnceLock<QuranMetadata> = OnceLock::new();

const METADATA_JSON: &str = include_str!("../data/quran_metadata.json");

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Surah {
    pub number: u8,
    pub name_arabic: String,
    pub name_english: String,
    pub name_transliteration: String,
    pub ayah_count: u16,
    pub revelation_type: String,
    pub start_page: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PageInfo {
    pub page_number: u16,
    pub juz: u8,
    pub start_surah: u8,
    pub start_ayah: u16,
    pub end_surah: u8,
    pub end_ayah: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AyahLocation {
    pub surah: u8,
    pub ayah: u16,
    pub page: u16,
    pub juz: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuranMetadata {
    pub surahs: Vec<Surah>,
    pub pages: Vec<PageInfo>,
}

impl QuranMetadata {
    pub fn global() -> &'static QuranMetadata {
        METADATA.get_or_init(|| {
            serde_json::from_str(METADATA_JSON)
                .expect("Failed to parse embedded quran_metadata.json")
        })
    }
}

/// Get all 114 surahs
pub fn get_surahs() -> &'static [Surah] {
    &QuranMetadata::global().surahs
}

/// Get specific surah by number (1..=114)
pub fn get_surah(surah_number: u8) -> Option<Surah> {
    if surah_number == 0 || surah_number > 114 {
        return None;
    }
    QuranMetadata::global()
        .surahs
        .iter()
        .find(|s| s.number == surah_number)
        .cloned()
}

/// Get page info by page number (1..=604)
pub fn get_page_info(page_number: u16) -> Option<PageInfo> {
    if page_number == 0 || page_number > 604 {
        return None;
    }
    QuranMetadata::global()
        .pages
        .iter()
        .find(|p| p.page_number == page_number)
        .cloned()
}

/// Find page number for a given surah and ayah
pub fn get_page_for_ayah(surah_number: u8, ayah_number: u16) -> Option<u16> {
    let surah = get_surah(surah_number)?;
    if ayah_number == 0 || ayah_number > surah.ayah_count {
        return None;
    }

    for page in &QuranMetadata::global().pages {
        if is_ayah_in_page_range(surah_number, ayah_number, page) {
            return Some(page.page_number);
        }
    }
    None
}

/// Get juz number for a given surah and ayah
pub fn get_juz_for_ayah(surah_number: u8, ayah_number: u16) -> Option<u8> {
    let page_num = get_page_for_ayah(surah_number, ayah_number)?;
    let page_info = get_page_info(page_num)?;
    Some(page_info.juz)
}

/// Helper: check if (surah, ayah) falls within a page's boundary
fn is_ayah_in_page_range(surah: u8, ayah: u16, page: &PageInfo) -> bool {
    if surah < page.start_surah || surah > page.end_surah {
        return false;
    }
    if surah == page.start_surah && ayah < page.start_ayah {
        return false;
    }
    if surah == page.end_surah && ayah > page.end_ayah {
        return false;
    }
    true
}

/// Get list of all ayahs on a given page (1..=604)
pub fn get_ayahs_for_page(page_number: u16) -> Vec<AyahLocation> {
    let page = match get_page_info(page_number) {
        Some(p) => p,
        None => return Vec::new(),
    };

    let mut result = Vec::new();
    let meta = QuranMetadata::global();

    for s_num in page.start_surah..=page.end_surah {
        let surah = match meta.surahs.iter().find(|s| s.number == s_num) {
            Some(s) => s,
            None => continue,
        };

        let start_a = if s_num == page.start_surah {
            page.start_ayah
        } else {
            1
        };

        let end_a = if s_num == page.end_surah {
            page.end_ayah
        } else {
            surah.ayah_count
        };

        for a_num in start_a..=end_a {
            result.push(AyahLocation {
                surah: s_num,
                ayah: a_num,
                page: page_number,
                juz: page.juz,
            });
        }
    }

    result
}

/// Get ayah locations for an ayah range within a surah
pub fn get_ayah_range(
    surah_number: u8,
    start_ayah: u16,
    end_ayah: u16,
) -> Result<Vec<AyahLocation>, String> {
    let surah = get_surah(surah_number)
        .ok_or_else(|| format!("Invalid surah number: {}", surah_number))?;

    if start_ayah == 0 || start_ayah > surah.ayah_count {
        return Err(format!(
            "Invalid start ayah {} for surah {} (max {})",
            start_ayah, surah_number, surah.ayah_count
        ));
    }
    if end_ayah < start_ayah || end_ayah > surah.ayah_count {
        return Err(format!(
            "Invalid end ayah {} for surah {} (max {})",
            end_ayah, surah_number, surah.ayah_count
        ));
    }

    let mut result = Vec::new();
    for a in start_ayah..=end_ayah {
        let page = get_page_for_ayah(surah_number, a).unwrap_or(1);
        let juz = get_juz_for_ayah(surah_number, a).unwrap_or(1);
        result.push(AyahLocation {
            surah: surah_number,
            ayah: a,
            page,
            juz,
        });
    }

    Ok(result)
}

/// Get pages for a page range (e.g. page 1 to 5)
pub fn get_pages_for_range(start_page: u16, end_page: u16) -> Vec<PageInfo> {
    if start_page == 0 || end_page < start_page || end_page > 604 {
        return Vec::new();
    }
    (start_page..=end_page)
        .filter_map(get_page_info)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_total_surahs_and_pages() {
        let surahs = get_surahs();
        assert_eq!(surahs.len(), 114);

        let meta = QuranMetadata::global();
        assert_eq!(meta.pages.len(), 604);
    }

    #[test]
    fn test_surah_lookup() {
        let fatiha = get_surah(1).unwrap();
        assert_eq!(fatiha.name_english, "Al-Faatiha");
        assert_eq!(fatiha.name_transliteration, "The Opening");
        assert_eq!(fatiha.ayah_count, 7);
        assert_eq!(fatiha.start_page, 1);

        let baqarah = get_surah(2).unwrap();
        assert_eq!(baqarah.name_english, "Al-Baqara");
        assert_eq!(baqarah.ayah_count, 286);
        assert_eq!(baqarah.start_page, 2);

        let nas = get_surah(114).unwrap();
        assert_eq!(nas.name_english, "An-Naas");
        assert_eq!(nas.ayah_count, 6);

        assert!(get_surah(0).is_none());
        assert!(get_surah(115).is_none());
    }

    #[test]
    fn test_page_1_ayahs() {
        let ayahs = get_ayahs_for_page(1);
        assert_eq!(ayahs.len(), 7);
        assert_eq!(ayahs[0].surah, 1);
        assert_eq!(ayahs[0].ayah, 1);
        assert_eq!(ayahs[6].surah, 1);
        assert_eq!(ayahs[6].ayah, 7);
    }

    #[test]
    fn test_page_604_multi_surah_ayahs() {
        let ayahs = get_ayahs_for_page(604);
        // Surah 112: 4 ayahs, Surah 113: 5 ayahs, Surah 114: 6 ayahs = 15 ayahs
        assert_eq!(ayahs.len(), 15);
        assert_eq!(ayahs[0].surah, 112);
        assert_eq!(ayahs[0].ayah, 1);
        assert_eq!(ayahs[14].surah, 114);
        assert_eq!(ayahs[14].ayah, 6);
    }

    #[test]
    fn test_ayat_al_kursi_lookup() {
        // Surah 2 Ayah 255 -> Page 42, Juz 3
        let page = get_page_for_ayah(2, 255).unwrap();
        assert_eq!(page, 42);

        let juz = get_juz_for_ayah(2, 255).unwrap();
        assert_eq!(juz, 3);
    }

    #[test]
    fn test_ayah_range() {
        let range = get_ayah_range(1, 1, 7).unwrap();
        assert_eq!(range.len(), 7);

        let range2 = get_ayah_range(2, 255, 257).unwrap();
        assert_eq!(range2.len(), 3);
        assert_eq!(range2[0].ayah, 255);
        assert_eq!(range2[2].ayah, 257);

        assert!(get_ayah_range(1, 0, 5).is_err());
        assert!(get_ayah_range(1, 5, 10).is_err()); // Fatiha only has 7 ayahs
    }
}
