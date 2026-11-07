export class GBCQuantizer {
  constructor(width = 144, height = 160) {
    this.width = width;
    this.height = height;
    
    // GBC Hardware Specs: 8 Palet x 4 Warna = 32 Warna Global
    this.NUM_PALETTES = 8;
    this.COLORS_PER_PALETTE = 4;
    
    this.globalPalettes = []; // Array of 8 palettes (each has 4 colors)
    this.lut = new Uint8Array(32768 * 3); // 15-bit RGB LUT
    this.frameCounter = 0;
  }

  // Quantize 8-bit color to GBC 5-bit color channel (0..31 -> 0..255)
  toGBCColor(val) {
    return (val >> 3) << 3; // Pembulatan ke kelipatan 8 ala GBC
  }

  rgbTo5BitIndex(r, g, b) {
    return ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  }

  processImageData(imageData) {
    const data = imageData.data;
    this.frameCounter++;

    // Rebuild GBC Master Palette & LUT tiap 3 frame
    if (this.frameCounter % 3 === 1 || this.globalPalettes.length === 0) {
      this.generateGBCPalettes(data);
      this.buildGBCLUT();
    }

    // Color Mapping piksel ke palet GBC terdekat via LUT
    for (let i = 0; i < data.length; i += 4) {
      const lutIdx = this.rgbTo5BitIndex(data[i], data[i + 1], data[i + 2]) * 3;
      data[i]     = this.lut[lutIdx];     // Red GBC
      data[i + 1] = this.lut[lutIdx + 1]; // Green GBC
      data[i + 2] = this.lut[lutIdx + 2]; // Blue GBC
    }

    return imageData;
  }

  generateGBCPalettes(data) {
    // 1. Kumpulkan semua piksel & kuantisasi ke 15-bit RGB
    const colorCounts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = this.toGBCColor(data[i]);
      const g = this.toGBCColor(data[i + 1]);
      const b = this.toGBCColor(data[i + 2]);
      const key = (r << 16) | (g << 8) | b;
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
    }

    // Sort warna dominan
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => ({
        r: (entry[0] >> 16) & 255,
        g: (entry[0] >> 8) & 255,
        b: entry[0] & 255
      }));

    // 2. Bagi ke 8 Palet (masing-masing 4 warna)
    this.globalPalettes = [];
    let pool = sortedColors.length > 0 ? sortedColors : [{ r: 0, g: 0, b: 0 }];

    for (let p = 0; p < this.NUM_PALETTES; p++) {
      const palette = [];
      for (let c = 0; c < this.COLORS_PER_PALETTE; c++) {
        const idx = Math.floor((p * this.COLORS_PER_PALETTE + c) * (pool.length / 32)) % pool.length;
        palette.push(pool[idx] || pool[0]);
      }
      this.globalPalettes.push(palette);
    }
  }

  buildGBCLUT() {
    // Flatten 8 palet x 4 warna menjadi 32 warna aktif di layar
    const active32Colors = this.globalPalettes.flat();

    for (let i = 0; i < 32768; i++) {
      const r = ((i >> 10) & 31) << 3;
      const g = ((i >> 5) & 31) << 3;
      const b = (i & 31) << 3;

      let minDistance = Infinity;
      let closestColor = active32Colors[0];

      for (let col of active32Colors) {
        const dr = r - col.r;
        const dg = g - col.g;
        const db = b - col.b;
        const dist = dr * dr + dg * dg + db * db;

        if (dist < minDistance) {
          minDistance = dist;
          closestColor = col;
        }
      }

      const lutIdx = i * 3;
      this.lut[lutIdx]     = closestColor.r;
      this.lut[lutIdx + 1] = closestColor.g;
      this.lut[lutIdx + 2] = closestColor.b;
    }
  }
}
