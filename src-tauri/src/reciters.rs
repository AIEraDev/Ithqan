use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Reciter {
    pub id: String,
    pub name: String,
    pub subfolder: String,
    pub bitrate: String,
}

pub fn get_default_reciters() -> Vec<Reciter> {
    vec![
        Reciter {
            id: "alafasy".to_string(),
            name: "Mishari Rashid al-`Afasy".to_string(),
            subfolder: "Alafasy_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "husary".to_string(),
            name: "Mahmoud Khalil Al-Husary (Murattal)".to_string(),
            subfolder: "Husary_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "husary_muallim".to_string(),
            name: "Mahmoud Khalil Al-Husary (Muallim)".to_string(),
            subfolder: "Husary_Muallim_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "husary_mujawwad".to_string(),
            name: "Mahmoud Khalil Al-Husary (Mujawwad)".to_string(),
            subfolder: "Husary_128kbps_Mujawwad".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "minshawi_murattal".to_string(),
            name: "Mohamed Siddiq al-Minshawi (Murattal)".to_string(),
            subfolder: "Minshawy_Murattal_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "minshawi_mujawwad".to_string(),
            name: "Mohamed Siddiq al-Minshawi (Mujawwad)".to_string(),
            subfolder: "Minshawy_Mujawwad_192kbps".to_string(),
            bitrate: "192kbps".to_string(),
        },
        Reciter {
            id: "abdul_basit_murattal".to_string(),
            name: "Abdul Basit Abdul Samad (Murattal)".to_string(),
            subfolder: "Abdul_Basit_Murattal_192kbps".to_string(),
            bitrate: "192kbps".to_string(),
        },
        Reciter {
            id: "abdul_basit_mujawwad".to_string(),
            name: "Abdul Basit Abdul Samad (Mujawwad)".to_string(),
            subfolder: "Abdul_Basit_Mujawwad_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "sudais".to_string(),
            name: "Abdul Rahman Al-Sudais".to_string(),
            subfolder: "Abdurrahmaan_As-Sudais_192kbps".to_string(),
            bitrate: "192kbps".to_string(),
        },
        Reciter {
            id: "shuraym".to_string(),
            name: "Sa'ud al-Shuraym".to_string(),
            subfolder: "Saood_ash-Shuraym_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "muaiqly".to_string(),
            name: "Maher Al-Muaiqly".to_string(),
            subfolder: "MaherAlMuaiqly128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "ghamadi".to_string(),
            name: "Saad Al-Ghamdi".to_string(),
            subfolder: "Ghamadi_40kbps".to_string(),
            bitrate: "40kbps".to_string(),
        },
        Reciter {
            id: "shatri".to_string(),
            name: "Abu Bakr al-Shatri".to_string(),
            subfolder: "Abu_Bakr_Ash-Shaatree_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "dosari".to_string(),
            name: "Yasser Al-Dosari".to_string(),
            subfolder: "Yasser_Ad-Dussary_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "jaber".to_string(),
            name: "Ali Jaber".to_string(),
            subfolder: "Ali_Jaber_64kbps".to_string(),
            bitrate: "64kbps".to_string(),
        },
        Reciter {
            id: "rifai".to_string(),
            name: "Hani Ar-Rifai".to_string(),
            subfolder: "Hani_Rifai_192kbps".to_string(),
            bitrate: "192kbps".to_string(),
        },
        Reciter {
            id: "ayyub".to_string(),
            name: "Muhammad Ayyub".to_string(),
            subfolder: "Muhammad_Ayyoub_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "jibreel".to_string(),
            name: "Muhammad Jibreel".to_string(),
            subfolder: "Muhammad_Jibreel_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "tablawi".to_string(),
            name: "Mohammad al-Tablawi".to_string(),
            subfolder: "Mohammad_al_Tablaway_128kbps".to_string(),
            bitrate: "128kbps".to_string(),
        },
        Reciter {
            id: "ismail".to_string(),
            name: "Mustafa Ismail".to_string(),
            subfolder: "Mustafa_Ismail_48kbps".to_string(),
            bitrate: "48kbps".to_string(),
        },
    ]
}

pub fn get_reciter_by_id(id: &str) -> Option<Reciter> {
    get_default_reciters().into_iter().find(|r| r.id == id)
}
