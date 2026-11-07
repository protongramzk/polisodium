// db.js

// 1. DICTIONARY KARAKTER PARTY (Hero Units)
export const CHARACTERS = {
  1: {
    id: 1,
    spriteIndex: 1,
    name: "MC",
    role: "All-Rounder",
    stats: { max_hp: 120, current_hp: 120, max_sp: 50, current_sp: 50, atk: 15, def: 10, speed: 12, luck: 5 }
  },
  2: {
    id: 2,
    spriteIndex: 2,
    name: "Asad",
    role: "Tank / Heavy Hit",
    stats: { max_hp: 160, current_hp: 160, max_sp: 30, current_sp: 30, atk: 12, def: 15, speed: 8, luck: 3 }
  },
  3: {
    id: 3,
    spriteIndex: 3,
    name: "Manto",
    role: "Speed Brawler",
    stats: { max_hp: 100, current_hp: 100, max_sp: 40, current_sp: 40, atk: 18, def: 8, speed: 16, luck: 8 }
  },
  15: {
    id: 15,
    spriteIndex: 25,
    name: "MC",
    role: "Solo Master",
    stats: { max_hp: 180, current_hp: 180, max_sp: 80, current_sp: 80, atk: 28, def: 14, speed: 18, luck: 10 }
  }
};

// 2. DICTIONARY MUSUH (Enemies - Chronological Order)
export const ENEMIES = {
  // Battle 1: Pertikaian Puruk Cahu
  4: {
    id: 4,
    spriteIndex: 15,
    name: "Provokator 1",
    role: "Scout / Provocateur",
    stats: { max_hp: 45, current_hp: 45, atk: 10, def: 4, speed: 14, exp_yield: 15, gold_yield: 10 },
    ai_behavior: "aggressive"
  },

  // Battle 2: Pengganggu Proyek Menara Telekomunikasi
  5: {
    id: 5,
    spriteIndex: 4,
    name: "Preman Tower 1",
    role: "Brawler",
    stats: { max_hp: 55, current_hp: 55, atk: 12, def: 5, speed: 11, exp_yield: 20, gold_yield: 15 },
    ai_behavior: "aggressive"
  },
  6: {
    id: 6,
    spriteIndex: 5,
    name: "Preman Tower 2",
    role: "Brawler",
    stats: { max_hp: 60, current_hp: 60, atk: 13, def: 6, speed: 10, exp_yield: 22, gold_yield: 15 },
    ai_behavior: "aggressive"
  },

  // Battle 3: Penghadang Jalanan / Preman Topeng
  7: {
    id: 7,
    spriteIndex: 16,
    name: "Preman Topeng 1",
    role: "Ambushed Unit",
    stats: { max_hp: 65, current_hp: 65, atk: 14, def: 6, speed: 13, exp_yield: 25, gold_yield: 18 },
    ai_behavior: "tactical"
  },
  8: {
    id: 8,
    spriteIndex: 17,
    name: "Preman Topeng 2",
    role: "Ambushed Unit",
    stats: { max_hp: 70, current_hp: 70, atk: 15, def: 7, speed: 12, exp_yield: 28, gold_yield: 20 },
    ai_behavior: "tactical"
  },

  // Battle 4: Penebang Pohon Hutan Ampah
  9: {
    id: 9,
    spriteIndex: 8,
    name: "Penebang Pohon 1",
    role: "Heavy Striker",
    stats: { max_hp: 85, current_hp: 85, atk: 18, def: 8, speed: 9, exp_yield: 35, gold_yield: 25 },
    ai_behavior: "heavy_attacker"
  },
  10: {
    id: 10,
    spriteIndex: 23,
    name: "Penebang Pohon 2",
    role: "Heavy Tanker",
    stats: { max_hp: 95, current_hp: 95, atk: 17, def: 10, speed: 8, exp_yield: 40, gold_yield: 30 },
    ai_behavior: "heavy_attacker"
  },

  // Battle 5: Provokator Kereng Pangi
  11: {
    id: 11,
    spriteIndex: 18,
    name: "Provokator Pasar 1",
    role: "Agile Striker",
    stats: { max_hp: 80, current_hp: 80, atk: 16, def: 7, speed: 15, exp_yield: 35, gold_yield: 25 },
    ai_behavior: "tactical"
  },
  12: {
    id: 12,
    spriteIndex: 19,
    name: "Provokator Pasar 2",
    role: "Tactician",
    stats: { max_hp: 85, current_hp: 85, atk: 17, def: 8, speed: 14, exp_yield: 38, gold_yield: 28 },
    ai_behavior: "tactical"
  },

  // Battle 6 & 7: Penjaga Markas & Security Pengkhianat (Sampit)
  13: {
    id: 13,
    spriteIndex: 20,
    name: "Penjaga Markas",
    role: "Guard",
    stats: { max_hp: 110, current_hp: 110, atk: 20, def: 10, speed: 12, exp_yield: 50, gold_yield: 40 },
    ai_behavior: "aggressive"
  },
  14: {
    id: 14,
    spriteIndex: 21,
    name: "Security",
    role: "Elite Traitor",
    stats: { max_hp: 140, current_hp: 140, atk: 22, def: 11, speed: 16, exp_yield: 70, gold_yield: 60 },
    ai_behavior: "boss_pattern"
  },

  // Battle 8: Final Boss Duel (ID Terakhir)
  16: {
    id: 16,
    spriteIndex: 26,
    name: "Tuan Tebang",
    role: "Final Boss",
    stats: { max_hp: 320, current_hp: 320, atk: 30, def: 14, speed: 15, exp_yield: 200, gold_yield: 150 },
    ai_behavior: "boss_pattern"
  }
};
export const BATTLE = {
  // Battle 1: Mengejar & mengepung Provokator di Puruk Cahu (dialogue ID 58)
  1: {
    name: "Pertikaian Puruk Cahu",
    location: "Jalan Kecil Puruk Cahu",
    party: [
      { id: 1, moveIds: ["move_tinju", "move_ranting_kayu"] }, // MC
      { id: 2, moveIds: ["move_tinju", "move_mandau_slash"] }, // Asad
      { id: 3, moveIds: ["move_tinju", "move_celurit_slash"] }  // Manto
    ],
    enemies: [
      { id: 4, moveIds: ["move_tinju", "move_provokasi_massa"] } // Provokator Puruk Cahu
    ]
  },

  // Battle 2: Menghadapi 3 Pengganggu Tower di Proyek Telekomunikasi (dialogue ID 99)
  2: {
    name: "Keributan Menara Telekomunikasi",
    location: "Area Proyek Tower Puruk Cahu",
    party: [
      { id: 1, moveIds: ["move_tinju", "move_ranting_kayu", "move_analisis_linux"] },
      { id: 2, moveIds: ["move_tinju", "move_mandau_slash", "move_raket_smash"] },
      { id: 3, moveIds: ["move_tinju", "move_celurit_slash", "move_siraman_cabai"] }
    ],
    enemies: [
      { id: 4, moveIds: ["move_tinju", "move_lempar_batu"] },
      { id: 5, moveIds: ["move_kick", "move_lempar_batu"] }
    ]
  },

  // Battle 3: Menghadapi Preman Topeng yang melempar mobil di Muara Teweh (dialogue ID 160)
  3: {
    name: "Penghadangan Preman Topeng",
    location: "Pinggir Sungai Muara Teweh",
    party: [
      { id: 1, moveIds: ["move_tinju", "move_ranting_kayu"] },
      { id: 2, moveIds: ["move_tinju", "move_mandau_slash"] },
      { id: 3, moveIds: ["move_tinju", "move_celurit_slash"] }
    ],
    enemies: [
      { id: 4, moveIds: ["move_tinju", "move_lempar_batu"] },
      { id: 5, moveIds: ["move_kick", "move_provokasi_massa"] }
    ]
  },

  // Battle 4: Melawan Penebang Pohon Liar di Hutan Buntok-Ampah (dialogue ID 210)
  4: {
    name: "Pertarungan Hutan Ampah",
    location: "Hutan Buntok-Ampah",
    party: [
      { id: 1, moveIds: ["move_tinju"] }, // MC belum menemukan kayunya
      { id: 2, moveIds: ["move_tinju", "move_mandau_slash"] },
      { id: 3, moveIds: ["move_tinju", "move_celurit_slash"] }
    ],
    enemies: [
      { id: 5, moveIds: ["move_tinju", "move_kick"] } // Penebang Pohon Bertubuh Besar
    ]
  },

  // Battle 5: Menghadapi Provokator di Kereng Pangi (dialogue ID 286)
  5: {
    name: "Kericuhan Pasar Kereng Pangi",
    location: "Kereng Pangi",
    party: [
      { id: 2, moveIds: ["move_tinju", "move_mandau_slash"] }, // Hanya Asad & Manto yang turun
      { id: 3, moveIds: ["move_tinju", "move_celurit_slash"] }
    ],
    enemies: [
      { id: 4, moveIds: ["move_tinju", "move_provokasi_massa"] },
      { id: 5, moveIds: ["move_kick", "move_lempar_batu"] }
    ]
  },

  // Battle 6: MC bertarung Solo melawan Penjaga Markas Sampit (dialogue ID 343)
  6: {
    name: "Penyusupan Penginapan Sampit",
    location: "Lorong Penginapan Sampit",
    party: [
      { id: 1, moveIds: ["move_tinju", "move_mandau_slash", "move_celurit_slash"] } // MC memegang Dual-Weapon (Mandau + Celurit)
    ],
    enemies: [
      { id: 5, moveIds: ["move_tinju", "move_kick"] } // Penjaga Markas
    ]
  },

  // Battle 7: MC Solo melawan Pengkhianat (Security) & Guard di Lorong Sel (dialogue ID 372)
  7: {
    name: "Penyergapan Sel Jeruji",
    location: "Lorong Sel Markas Sampit",
    party: [
      { id: 1, moveIds: ["move_tinju", "move_mandau_slash", "move_celurit_slash"] } // Dual-Weapon Solo
    ],
    enemies: [
      { id: 4, moveIds: ["move_tinju", "move_provokasi_massa"] }, // Security Pengkhianat
      { id: 5, moveIds: ["move_kick", "move_lempar_batu"] }        // Penjaga
    ]
  },

  // Battle 8: Boss Battle MC melawan Tuan Tebang di Ruang Utama (dialogue ID 380)
  8: {
    name: "Pertarungan Akhir: Tuan Tebang",
    location: "Ruang Utama Markas Sampit",
    party: [
      { id: 1, moveIds: ["move_tinju", "move_mandau_slash", "move_celurit_slash"] }
    ],
    enemies: [
      { id: 5, moveIds: ["move_tinju", "move_kick", "move_mandau_slash"] } // Tuan Tebang (Boss)
    ]
  }
};

// 3. MOVES DATABASE
export const MOVES = {
  "moves": [
    {
      "id": "move_tinju",
      "name": "Tinju",
      "type": "Physical",
      "sp_cost": 0,
      "power": 10,
      "accuracy": 100,
      "target_type": "single_enemy",
      "description": "Pukulan tangan kosong tanpa konsumsi SP."
    },
    {
      "id": "move_kick",
      "name": "Tendang",
      "type": "Physical",
      "sp_cost": 0,
      "power": 12,
      "accuracy": 95,
      "target_type": "single_enemy",
      "description": "Tendangan mendadak untuk membuka celah pertahanan."
    },
    {
      "id": "move_ranting_kayu",
      "name": "Pukul Kayu",
      "type": "Physical",
      "sp_cost": 5,
      "power": 18,
      "accuracy": 90,
      "target_type": "single_enemy",
      "description": "Senjata darurat MC menggunakan ranting kayu besar."
    },
    {
      "id": "move_celurit_slash",
      "name": "Celurit",
      "type": "Slash",
      "sp_cost": 8,
      "power": 26,
      "accuracy": 92,
      "target_type": "single_enemy",
      "description": "Sabetan celurit tajam milik Manto."
    },
    {
      "id": "move_mandau_slash",
      "name": "Mandau",
      "type": "Slash",
      "sp_cost": 12,
      "power": 38,
      "accuracy": 88,
      "target_type": "single_enemy",
      "description": "Tebasan berbobot berat dari Mandau Asad."
    },
    {
      "id": "move_celurit_mandau_combo",
      "name": "CeluritMandau",
      "type": "Slash",
      "sp_cost": 35,
      "power": 85,
      "accuracy": 90,
      "crit_rate": 15,
      "target_type": "single_enemy",
      "description": "Jurus pamungkas MC memegang Celurit & Mandau sekaligus."
    },
    {
      "id": "move_pedang_tuan_tebang",
      "name": "Tebasan Pedang",
      "type": "Slash",
      "sp_cost": 18,
      "power": 55,
      "accuracy": 95,
      "crit_rate": 25,
      "target_type": "single_enemy",
      "description": "Tebasan pedang berkelas dan presisi tinggi dari Tuan Tebang."
    }
  ]
};

// 4. DATABASE UTILITY API
export const DB = {
  getCharInstance(id) {
    const data = CHARACTERS[id];
    return data ? structuredClone(data) : null;
  },

  getEnemyInstance(id) {
    const data = ENEMIES[id];
    return data ? structuredClone(data) : null;
  },

  getMove(id) {
    if (Array.isArray(MOVES.moves)) {
      return MOVES.moves.find(m => m.id === id) || null;
    }
    return MOVES[id] || null;
  },

  getCharacterList() {
    return Object.values(CHARACTERS);
  },

  getEnemyList() {
    return Object.values(ENEMIES);
  },

  getMoveList() {
    return Array.isArray(MOVES.moves) ? MOVES.moves : Object.values(MOVES);
  }
};
