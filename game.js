(() => {
  'use strict';
  const DATA = window.POLISODIUM_DATA;
  const STORIES = window.POLISODIUM_STORIES;
  const SAVE_KEY = 'polisodium-state-v1';
  const W = 160, H = 144;
  const PALETTE = { black: 0x000000, dark: 0x555555, light: 0xaaaaaa, white: 0xffffff };
  const SOLID_RGB = new Set(['0,0,0', '85,85,85']);
  const $error = document.getElementById('error');

  function freshState() {
    return { episode: 1, hp: DATA.player.maxHp, defeated: [], storySeen: [], mode: 'story', ending: false };
  }
    function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...freshState(), mode: 'intro', hasSave: false };
      
      const saved = JSON.parse(raw);
      const state = { ...freshState(), ...saved };
      
      state.episode = Math.max(1, Math.min(8, Number(state.episode) || 1));
      state.hp = Math.max(1, Math.min(DATA.player.maxHp, Number(state.hp) || DATA.player.maxHp));
      if (!Array.isArray(state.defeated)) state.defeated = [];
      if (!Array.isArray(state.storySeen)) state.storySeen = [];

      // Simpan mode game terakhir (world/story) buat dipanggil pas tombol LOAD ditekan
      state.savedMode = saved.mode || (state.storySeen.includes(state.episode) ? 'world' : 'story');
      
      // FIX: Paksa selalu masuk ke intro tiap kali window/browser di-reload!
      state.mode = 'intro';
      state.hasSave = true;
      return state;
    } catch {
      return { ...freshState(), mode: 'intro', hasSave: false };
    }
  }

  const app = {
    state: loadState(),
    scene: null,
    heldDirection: null,
    pressA() { if (this.scene) this.scene.handleA(); },
    pressB() { /* B sengaja belum dipakai dalam spesifikasi kontrol. */ },
    setDirection(direction) { this.heldDirection = direction; },
    clearDirection() { this.heldDirection = null; },
    save() {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); }
      catch (err) { console.warn('Gagal menyimpan localStorage', err); }
    }
  };
  window.PolisodiumGame = app;

  class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    preload() {
      this.load.image('logo', 'public/logo.png');
      this.load.spritesheet('player', DATA.player.sprite.path, {
        frameWidth: DATA.player.sprite.frameWidth, frameHeight: DATA.player.sprite.frameHeight
      });
      this.load.spritesheet('ghosts', '/public/ghosts.png', { frameWidth: 16, frameHeight: 32 });
      Object.entries(DATA.episodes).forEach(([episode, cfg]) => {
        this.load.image(`map${episode}`, cfg.map);
      });
    }

    create() {
      app.scene = this;
      this.cameras.main.setRoundPixels(true);
      this.cameras.main.setBackgroundColor('#ffffff');
      this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP, down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W, a: Phaser.Input.Keyboard.KeyCodes.A,
        s: Phaser.Input.Keyboard.KeyCodes.S, d: Phaser.Input.Keyboard.KeyCodes.D,
        confirm: Phaser.Input.Keyboard.KeyCodes.Z, enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        space: Phaser.Input.Keyboard.KeyCodes.SPACE, escape: Phaser.Input.Keyboard.KeyCodes.X
      });
      this.createAnimations();
      this.beginCurrentMode();
    }
       transitionToMode(callback) {
      const cam = this.cameras.main;

      // 1. Shake & Fade Out
      cam.shake(300, 0.015);
      cam.fadeOut(400, 0, 0, 0);

      // 2. Pas layar udah gelap pekat, eksekusi ganti mode
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        cam.resetFX(); // Bersihkan efek fade out
        
        if (typeof callback === 'function') callback();

        // 3. Terangkan lagi layarnya (Fade In)
        cam.fadeIn(400, 0, 0, 0);
      });
    }

    createAnimations() {
      const anims = DATA.player.animations;
      for (const [direction, frames] of Object.entries(anims)) {
        const key = `walk-${direction}`;
        if (!this.anims.exists(key)) this.anims.create({
          key, frames: frames.map(frame => ({ key: 'player', frame })), frameRate: 8, repeat: -1
        });
      }
    }

    clearSceneObjects() {
      const oldWorldLayer = this.worldLayer;
      if (oldWorldLayer) oldWorldLayer.destroy(true);
      if (this.modeLayer && this.modeLayer !== oldWorldLayer) this.modeLayer.destroy(true);
      this.worldLayer = null;
      this.modeLayer = null;
      this.player = null;
      this.mapImage = null;
      this.storyText = null;
      this.battleButtons = [];
    }

       beginCurrentMode() {
      this.clearSceneObjects();
      
      // PENTING: Cek 'intro' dulu sebelum cek 'story' atau 'world'!
      if (app.state.mode === 'intro') this.showIntro();
      else if (app.state.ending) this.showEnding();
      else if (app.state.episode === 8 || app.state.mode === 'story') this.showStory(app.state.episode);
      else if (app.state.mode === 'world') this.showWorld();
      else this.showStory(app.state.episode);
      
      app.save();
    }

         // ============================================================
    // INTRO SCREEN (Background Putih + Fix Text & Navigation)
    // ============================================================
    showIntro() {
      this.clearSceneObjects();
      this.cameras.main.setScroll(0, 0);
      
      // 1. Ubah background intro jadi PUTIH
      this.cameras.main.setBackgroundColor('#ffffff');
      this.mode = 'intro';

      this.introLayer = this.add.container(0, 0);
      this.modeLayer = this.introLayer;

      const hasSave = app.state.hasSave;
      this.introOptions = hasSave ? ['LOAD', 'NEW_GAME'] : ['NEW_GAME'];
      this.introSelection = 0;

      // 2. Logo Animasi (Jatuh + Bounce)
      this.logoSprite = this.add.image(W / 2, -70, 'logo').setOrigin(0.5, 0.5);
      this.logoSprite.setScale(0.42);
      this.introLayer.add(this.logoSprite);

      this.tweens.add({
        targets: this.logoSprite,
        y: 40,
        duration: 800,
        ease: 'Bounce.easeOut'
      });

      // 3. Setup Bar Menu
      this.introBars = [];
      const loadLabel = hasSave 
        ? `LOAD: EP.${app.state.episode} HP:${app.state.hp}`
        : `LOAD: NO SAVE`;

      const menuConfig = hasSave 
        ? [
            { id: 'LOAD', label: loadLabel },
            { id: 'NEW_GAME', label: 'NEW GAME' }
          ]
        : [
            { id: 'NEW_GAME', label: 'NEW GAME' }
          ];

      const startY = 82;
      const barHeight = 22;
      const spacing = 6;

      menuConfig.forEach((item, index) => {
        const yPos = startY + index * (barHeight + spacing);

        const barBg = this.add.graphics();
        const textObj = this.makeText(W / 2, yPos + (barHeight / 2), item.label, 6, '#000000', { align: 'center' })
          .setOrigin(0.5, 0.5);

        this.introLayer.add(barBg);
        this.introLayer.add(textObj);

        this.introBars.push({
          id: item.id,
          y: yPos,
          height: barHeight,
          bg: barBg,
          text: textObj,
          rawLabel: item.label
        });
      });

      // Siapkan key navigation agar tidak dibuat berulang kali di update()
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keyUp = this.input.keyboard.addKey(K.UP);
      this.keyDown = this.input.keyboard.addKey(K.DOWN);
      this.keyW = this.input.keyboard.addKey(K.W);
      this.keyS = this.input.keyboard.addKey(K.S);

      this.updateIntroLabels();
    }

    updateIntroLabels() {
      if (this.mode !== 'intro' || !this.introBars) return;

      this.introBars.forEach((bar, index) => {
        const isSelected = index === this.introSelection;
        bar.bg.clear();

        if (isSelected) {
          // Bar Terpilih: Kotak Hitam, Teks Putih
          bar.bg.fillStyle(PALETTE.black, 1);
          bar.bg.fillRect(12, bar.y, 136, bar.height);
          bar.bg.lineStyle(1, PALETTE.black, 1);
          bar.bg.strokeRect(12, bar.y, 136, bar.height);

          bar.text.setColor('#ffffff'); // FIX: Gunakan string hex warna langsung
          bar.text.setText(`> ${bar.rawLabel} <`);
        } else {
          // Bar Tidak Terpilih: Kotak Putih (Bordir Hitam), Teks Hitam
          bar.bg.fillStyle(PALETTE.white, 1);
          bar.bg.fillRect(12, bar.y, 136, bar.height);
          bar.bg.lineStyle(1, PALETTE.black, 1);
          bar.bg.strokeRect(12, bar.y, 136, bar.height);

          bar.text.setColor('#000000'); // FIX: Gunakan string hex warna langsung
          bar.text.setText(bar.rawLabel);
        }
      });
    }

    // ============================================================
    // UPDATE LOOP (Terhubung ke Keyboard & D-Pad Layar Sentuh)
    // ============================================================
    update(time, delta) {
      if (!this.input.keyboard) return;

      const JD = Phaser.Input.Keyboard.JustDown;

      // Tombol Konfirmasi (A / Z / Enter / Space)
      if (JD(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z)) ||
          JD(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)) ||
          JD(this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE))) {
        this.handleA();
      }

      // Input Navigasi Intro (Keyboard & Touch D-Pad)
      if (this.mode === 'intro') {
        // 1. Keyboard Navigation
        if (this.keyUp && (JD(this.keyUp) || JD(this.keyW))) {
          this.moveIntroSelection(-1);
        }
        if (this.keyDown && (JD(this.keyDown) || JD(this.keyS))) {
          this.moveIntroSelection(1);
        }

        // 2. Touch D-Pad Navigation
        if (app.heldDirection && app.heldDirection !== this.lastIntroDirection) {
          this.lastIntroDirection = app.heldDirection;
          if (app.heldDirection === 'up') this.moveIntroSelection(-1);
          if (app.heldDirection === 'down') this.moveIntroSelection(1);
        }
        if (!app.heldDirection) this.lastIntroDirection = null;
      }

      if (this.mode === 'world') this.updateWorldMovement();
      if (this.mode === 'battle') this.updateBattleInput();
    }

    moveIntroSelection(dir) {
      if (this.mode !== 'intro') return;
      const n = this.introOptions.length;
      this.introSelection = (this.introSelection + dir + n) % n;
      this.updateIntroLabels();
    }

    confirmIntroOption() {
      if (this.mode !== 'intro') return;
      const selected = this.introOptions[this.introSelection];

      if (selected === 'NEW_GAME') {
        localStorage.removeItem(SAVE_KEY);
        app.state = freshState();
        app.state.mode = 'story';
        app.save();
      } else if (selected === 'LOAD') {
        if (app.state.storySeen.includes(app.state.episode)) {
          app.state.mode = 'world';
        } else {
          app.state.mode = 'story';
        }
      }

      // Transisi getar & fade out
      this.transitionToMode(() => {
        this.beginCurrentMode();
      });
    }

    makeText(x, y, text, size = 8, color = '#000000', options = {}) {
      return this.add.text(x, y, text, {
        fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color,
        resolution: 1, lineSpacing: 2, ...options
      });
    }

    showStory(storyId) {
      const story = STORIES[storyId];
      if (!story) { this.showFatal(`Story ${storyId} tidak ditemukan.`); return; }
      app.state.mode = 'story';
      app.save();
      this.mode = 'story';
      this.storyId = storyId;
      this.story = story;
      this.pageIndex = 0;
      this.storyEnded = false;
      this.storyLayer = this.add.container(0, 0);
      this.modeLayer = this.storyLayer;

      const bg = this.add.graphics();
      bg.fillStyle(PALETTE.white, 1).fillRect(0, 0, W, H);
      bg.lineStyle(1, PALETTE.black, 1).strokeRect(1, 1, W - 2, H - 2);
      this.storyLayer.add(bg);
      this.storyLayer.add(this.makeText(6, 5, `[ ${story.title} ]`, 8, '#000000'));
      const divider = this.add.graphics();
      divider.lineStyle(1, PALETTE.dark, 1).lineBetween(5, 17, 155, 17);
      this.storyLayer.add(divider);
      this.storyText = this.makeText(7, 22, '', 8, '#000000', { wordWrap: { width: 145 } });
      this.storyLayer.add(this.storyText);
      const footer = this.add.graphics();
      footer.fillStyle(PALETTE.black, 1).fillRect(0, 112, W, 32);
      this.storyLayer.add(footer);
      this.storyCounter = this.makeText(6, 116, '', 6, '#aaaaaa');
      this.storyPrompt = this.makeText(6, 130, 'A: PERCEPAT', 7, '#ffffff');
      this.storyLayer.add([this.storyCounter, this.storyPrompt]);
      this.typed = '';
      this.charIndex = 0;
      this.typeTimer = null;
      this.displayStoryPage();
    }

    displayStoryPage() {
      if (this.pageIndex >= this.story.pages.length) { this.finishStory(); return; }
      this.fullPageText = String(this.story.pages[this.pageIndex] ?? '');
      this.typed = '';
      this.charIndex = 0;
      this.storyText.setText('');
      this.storyCounter.setText(`${this.pageIndex + 1}/${this.story.pages.length}`);
      this.storyPrompt.setText('A: PERCEPAT');
      this.isTyping = true;
      if (this.typeTimer) this.typeTimer.remove(false);
      this.typeTimer = this.time.addEvent({
        delay: 32, repeat: Math.max(0, this.fullPageText.length - 1),
        callback: () => {
          if (!this.isTyping) return;
          this.typed += this.fullPageText[this.charIndex++] || '';
          this.renderStoryText();
          if (this.charIndex >= this.fullPageText.length) this.completeTyping();
        }
      });
      if (!this.fullPageText.length) this.completeTyping();
    }

    wrapAndScroll(text, maxChars = 18, maxLines = 8) {
      const words = text.split(/\s+/);
      const lines = [];
      let line = '';
      for (const word of words) {
        if (!line) line = word;
        else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
        else { lines.push(line); line = word; }
        while (line.length > maxChars) {
          lines.push(line.slice(0, maxChars));
          line = line.slice(maxChars);
        }
      }
      if (line) lines.push(line);
      return lines.slice(-maxLines).join('\n');
    }

    renderStoryText() {
      this.storyText.setText(this.wrapAndScroll(this.typed));
    }

    completeTyping() {
      if (!this.isTyping) return;
      this.isTyping = false;
      if (this.typeTimer) this.typeTimer.remove(false);
      this.storyPrompt.setText(this.pageIndex === this.story.pages.length - 1
        ? `A: ${this.story.endLabel || 'SELESAI'}` : 'A: LANJUT');
    }

    handleA() {
      if (this.mode === 'story') {
        if (this.storyEnded) return;
        if (this.isTyping) {
          this.typed = this.fullPageText;
          this.charIndex = this.fullPageText.length;
          this.renderStoryText();
          this.completeTyping();
        } else {
          this.pageIndex++;
          this.displayStoryPage();
        }
      } else if (this.mode === 'battle') {
        this.chooseBattleAction(this.battleSelection || 0);
      }
      // A/B tidak melakukan apa pun saat mode world.
    }

        finishStory() {
      if (this.storyEnded) return;
      this.storyEnded = true;
      app.state.storySeen = [...new Set([...app.state.storySeen, this.storyId])];
      
      if (this.storyId === 1) {
        app.state.episode = 2;
        app.state.mode = 'story';
      } else if (this.storyId === 8) {
        app.state.ending = true;
        app.state.mode = 'ending';
      } else {
        app.state.mode = 'world';
      }
      app.save();

      // Panggil transisi shake + fade out
      this.transitionToMode(() => {
        if (this.storyId === 8) this.showEnding();
        else this.beginCurrentMode();
      });
    }


    showWorld() {
      const episode = app.state.episode;
      const cfg = DATA.episodes[episode];
      if (!cfg) { this.showStory(8); return; }
      this.mode = 'world';
      app.state.mode = 'world';
      app.save();
      this.worldLayer = this.add.container(0, 0);
      this.modeLayer = this.worldLayer;

      this.mapImage = this.add.image(0, 0, `map${episode}`).setOrigin(0, 0);
      this.worldLayer.add(this.mapImage);
      this.buildCollisionMap(episode);
      const [sx, sy] = cfg.spawn;
      this.player = this.add.sprite(sx, sy, 'player', DATA.player.directions.down.idleFrame);
      this.player.setOrigin(0.5, 0.5);
      this.worldLayer.add(this.player);
      this.playerBusy = false;
      this.lastDirection = 'down';
      this.cameras.main.setBounds(0, 0, 256, 256);
      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.setDeadzone(0, 0);
      this.cameras.main.setZoom(1);
      this.fightPoint = cfg.fight;
      this.fightRadius = cfg.radius;
      this.enemyId = cfg.enemyId;
      this.worldHud = this.makeText(3, 3, `EP ${episode}  HP ${app.state.hp}/${DATA.player.maxHp}`, 6, '#ffffff', {
        backgroundColor: '#000000', padding: { x: 2, y: 2 }, scrollFactor: 0
      });
      this.worldLayer.add(this.worldHud);
      this.fightMarker = this.add.circle(cfg.fight[0], cfg.fight[1], 3, 0xffffff, 0.65)
        .setStrokeStyle(1, 0x000000, 1);
      this.worldLayer.add(this.fightMarker);
      this.cameras.main.setBackgroundColor('#555555');
    }

       
    getKeyboardDirection() {
      const k = this.input.keyboard;
      const down = code => k.checkDown(this.input.keyboard.addKey(code), 0);
      if (down(Phaser.Input.Keyboard.KeyCodes.UP) || down(Phaser.Input.Keyboard.KeyCodes.W)) return 'up';
      if (down(Phaser.Input.Keyboard.KeyCodes.DOWN) || down(Phaser.Input.Keyboard.KeyCodes.S)) return 'down';
      if (down(Phaser.Input.Keyboard.KeyCodes.LEFT) || down(Phaser.Input.Keyboard.KeyCodes.A)) return 'left';
      if (down(Phaser.Input.Keyboard.KeyCodes.RIGHT) || down(Phaser.Input.Keyboard.KeyCodes.D)) return 'right';
      return null;
    }

    updateWorldMovement() {
      if (!this.player || this.playerBusy) return;
      const direction = app.heldDirection || this.getKeyboardDirection();
      if (!direction) {
        this.player.anims.stop();
        this.player.setFrame(DATA.player.directions[this.lastDirection].idleFrame);
        return;
      }
      const vector = DATA.player.directions[direction];
      this.lastDirection = direction;
      const nx = Phaser.Math.Clamp(this.player.x + vector.dx * DATA.player.sprite.stepSize, 8, 248);
      const ny = Phaser.Math.Clamp(this.player.y + vector.dy * DATA.player.sprite.stepSize, 8, 248);
      // #000000 dan #AAAAAA sama-sama solid. Tolak langkah sebelum tween dimulai.
      if (!this.canOccupy(nx, ny)) {
        this.player.anims.stop();
        this.player.setFrame(DATA.player.directions[direction].idleFrame);
        return;
      }
      this.player.anims.play(`walk-${direction}`, true);
      this.playerBusy = true;
      this.tweens.add({
        targets: this.player, x: nx, y: ny, duration: DATA.player.sprite.moveDuration, ease: 'Linear',
        onComplete: () => {
          this.playerBusy = false;
          this.checkFightPoint();
        }
      });
    }


    buildCollisionMap(episode) {
      // Baca warna asli file map, bukan warna hasil render di layar.
      const source = this.textures.get(`map${episode}`).getSourceImage();
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth || source.width || 256;
      canvas.height = source.naturalHeight || source.height || 256;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      try {
        this.collisionPixels = context.getImageData(0, 0, canvas.width, canvas.height);
        this.collisionWidth = canvas.width;
        this.collisionHeight = canvas.height;
      } catch (error) {
        this.collisionPixels = null;
        console.error('Tidak bisa membaca piksel collision map. Pastikan map berasal dari origin yang sama.', error);
        $error.textContent = 'Collision map gagal dibaca. Periksa path dan akses aset map.';
      }
    }

    isSolidPixel(x, y) {
      if (!this.collisionPixels) return false;
      const px = Math.floor(x);
      const py = Math.floor(y);
      if (px < 0 || py < 0 || px >= this.collisionWidth || py >= this.collisionHeight) return true;
      const i = (py * this.collisionWidth + px) * 4;
      const data = this.collisionPixels.data;
      if (data[i + 3] === 0) return false;
      return SOLID_RGB.has(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    }
canOccupy(x, y) {
  // Cukup cek 4 titik di area pusat/kaki (offset 3px dari titik tengah)
  // Makin kecil nilai offset (misal 2 atau 3), makin selip dan licin di celah kurva
  const margin = 0.1; 
  const points = [
    [x - margin, y - margin], 
    [x + margin, y - margin],
    [x - margin, y + margin], 
    [x + margin, y + margin]
  ];

  return points.every(([px, py]) => !this.isSolidPixel(px, py));
}


    checkFightPoint() {
      if (this.mode !== 'world' || !this.player) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.fightPoint[0], this.fightPoint[1]);
      if (distance <= this.fightRadius) this.startBattle(this.enemyId);
    }

    startBattle(enemyId) {
      if (this.mode !== 'world') return;
      this.mode = 'battle';
      app.state.mode = 'battle';
      app.save();
      this.enemy = structuredClone(DATA.ghosts.find(g => g.id === enemyId));
      if (!this.enemy) { this.showFatal(`Musuh ID ${enemyId} tidak ditemukan.`); return; }
      this.battleSelection = 0;
      this.battleBusy = false;
      this.battleMessage = `${this.enemy.name} muncul!`;
      this.cameras.main.stopFollow();
      this.clearSceneObjects();
      this.showBattle();
    }

    showBattle() {
      this.mode = 'battle';
      this.cameras.main.setBounds(0, 0, W, H);
      this.cameras.main.centerOn(W / 2, H / 2);
      this.cameras.main.setBackgroundColor('#ffffff');
      this.battleLayer = this.add.container(0, 0);
      this.modeLayer = this.battleLayer;
      const bg = this.add.graphics();
      bg.fillStyle(PALETTE.white, 1).fillRect(0, 0, W, H);
      bg.lineStyle(1, PALETTE.black, 1).strokeRect(1, 1, W - 2, H - 2);
      this.battleLayer.add(bg);
      this.battleLayer.add(this.makeText(6, 5, `EP ${app.state.episode}  BATTLE`, 7));
      this.enemySprite = this.add.sprite(112, 36, 'ghosts', this.enemy.frame).setOrigin(0.5, 0.5);
      this.enemySprite.setScale(2);
      this.battleLayer.add(this.enemySprite);
      this.enemyNameText = this.makeText(7, 20, this.enemy.name, 7);
      this.enemyHpText = this.makeText(7, 31, `HP ${this.enemy.hp}/${this.enemy.maxHp}`, 6);
      this.playerHpText = this.makeText(7, 47, `MC HP ${app.state.hp}/${DATA.player.maxHp}`, 6);
      this.battleLayer.add([this.enemyNameText, this.enemyHpText, this.playerHpText]);
      const panel = this.add.graphics();
      panel.fillStyle(PALETTE.black, 1).fillRect(3, 66, 154, 75);
      panel.lineStyle(1, PALETTE.white, 1).strokeRect(4, 67, 152, 73);
      this.battleLayer.add(panel);
      this.battleMessageText = this.makeText(8, 72, this.battleMessage, 6, '#ffffff', { wordWrap: { width: 142 } });
      this.battleLayer.add(this.battleMessageText);
      this.battleLabels = ['SERANG', 'TRIK', 'TENANG', 'PANCING'];
      this.battleLabels.forEach((label, i) => {
        const x = i % 2 === 0 ? 8 : 84;
        const y = 100 + Math.floor(i / 2) * 17;
        const text = this.makeText(x, y, `${i === this.battleSelection ? '>' : ' '} ${label}`, 7, '#ffffff');
        this.battleButtons.push(text);
        this.battleLayer.add(text);
      });
      this.updateBattleLabels();
    }

    updateBattleLabels() {
      this.battleButtons.forEach((text, i) => {
        text.setText(`${i === this.battleSelection ? '>' : ' '} ${this.battleLabels[i]}`);
      });
    }

    updateBattleInput() {
      const keys = this.input.keyboard;
      if (app.heldDirection && app.heldDirection !== this.lastBattleDirection) {
        this.lastBattleDirection = app.heldDirection;
        const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        const [dx, dy] = vectors[app.heldDirection];
        this.moveBattleSelection(dx, dy);
      }
      if (!app.heldDirection) this.lastBattleDirection = null;
      if (Phaser.Input.Keyboard.JustDown(keys.addKey(Phaser.Input.Keyboard.KeyCodes.UP))) this.moveBattleSelection(0, -1);
      if (Phaser.Input.Keyboard.JustDown(keys.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN))) this.moveBattleSelection(0, 1);
      if (Phaser.Input.Keyboard.JustDown(keys.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT))) this.moveBattleSelection(-1, 0);
      if (Phaser.Input.Keyboard.JustDown(keys.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT))) this.moveBattleSelection(1, 0);
    }

    moveBattleSelection(dx, dy) {
      if (this.mode !== 'battle' || this.battleBusy) return;
      let col = this.battleSelection % 2;
      let row = Math.floor(this.battleSelection / 2);
      col = (col + dx + 2) % 2;
      row = (row + dy + 2) % 2;
      this.battleSelection = row * 2 + col;
      this.updateBattleLabels();
    }

    chooseBattleAction(index) {
      if (this.mode !== 'battle' || this.battleBusy) return;
      this.battleBusy = true;
      const actions = [
        { name: 'Serang', damage: 12, message: 'MC menyerang!' },
        { name: 'Trik', damage: 20, message: 'Trik berhasil!' },
        { name: 'Tenang', heal: 14, message: 'MC menenangkan diri dan memulihkan HP.' },
        { name: 'Pancing', damage: 8, weaken: true, message: 'MC memancing lawan agar lengah!' }
      ];
      const action = actions[index];
      if (action.heal) app.state.hp = Math.min(DATA.player.maxHp, app.state.hp + action.heal);
      if (action.damage) this.enemy.hp = Math.max(0, this.enemy.hp - action.damage);
      this.battleMessageText.setText(action.message);
      this.refreshBattleStats();
      if (this.enemy.hp <= 0) {
        this.time.delayedCall(500, () => this.winBattle());
        return;
      }
      this.time.delayedCall(450, () => {
        const damage = Math.max(1, this.enemy.atk - (action.weaken ? 6 : 0));
        app.state.hp = Math.max(0, app.state.hp - damage);
        this.battleMessageText.setText(`${this.enemy.name} menyerang! MC -${damage} HP.`);
        this.refreshBattleStats();
        app.save();
        if (app.state.hp <= 0) {
          this.time.delayedCall(650, () => this.loseBattle());
        } else {
          this.time.delayedCall(650, () => {
            this.battleMessageText.setText('Pilih tindakan.');
            this.battleBusy = false;
          });
        }
      });
    }

    refreshBattleStats() {
      this.enemyHpText.setText(`HP ${this.enemy.hp}/${this.enemy.maxHp}`);
      this.playerHpText.setText(`MC HP ${app.state.hp}/${DATA.player.maxHp}`);
      app.save();
    }

       winBattle() {
      app.state.defeated = [...new Set([...app.state.defeated, this.enemy.id])];
      app.state.hp = Math.max(1, app.state.hp);
      app.state.episode = Math.min(8, app.state.episode + 1);
      app.state.mode = 'story';
      app.state.ending = false;
      app.save();

      this.transitionToMode(() => {
        this.beginCurrentMode();
      });
    }
    loseBattle() {
      app.state.hp = DATA.player.maxHp;
      app.state.mode = 'world';
      app.save();

      this.transitionToMode(() => {
        this.showBattleOver();
      });
    }

    showBattleOver() {
      this.clearSceneObjects();
      this.cameras.main.setScroll(0, 0);
      this.cameras.main.setBackgroundColor('#000000');
      this.mode = 'gameover';
      const text = this.makeText(12, 35, 'MC KALAH!\nHP DIPULIHKAN.', 8, '#ffffff', { align: 'center' });
      const prompt = this.makeText(8, 78, 'A: COBA LAGI', 7, '#ffffff');
      this.modeLayer = this.add.container(0, 0, [text, prompt]);
      this.gameover = true;
    }

    showEnding() {
      this.clearSceneObjects();
      this.cameras.main.setScroll(0, 0);
      this.cameras.main.setBackgroundColor('#000000');
      this.mode = 'ending';
      const title = this.makeText(18, 40, 'POLISODIUM', 10, '#ffffff');
      const sub = this.makeText(18, 62, 'TO BE CONTINUED...', 6, '#ffffff');
      const reset = this.makeText(18, 100, 'A: MAIN LAGI', 7, '#ffffff');
      this.modeLayer = this.add.container(0, 0, [title, sub, reset]);
    }

    showFatal(message) {
      $error.textContent = message;
      this.cameras.main.setBackgroundColor('#000000');
      this.add.text(5, 5, message, { fontFamily: 'monospace', fontSize: '8px', color: '#ffffff', wordWrap: { width: 150 } });
    }
  }

  // Extend A handling for game-over/restart and ending reset.
  const OriginalScene = GameScene;
  const originalHandleA = OriginalScene.prototype.handleA;
    OriginalScene.prototype.handleA = function() {
    if (this.mode === 'intro') {
      this.confirmIntroOption();
      return;
    }
    if (this.mode === 'gameover') {
      this.gameover = false;
      app.state.mode = 'world';
      app.save();
      this.beginCurrentMode();
      return;
    }
    if (this.mode === 'ending') {
      localStorage.removeItem(SAVE_KEY);
      app.state = freshState();
      app.save();
      this.beginCurrentMode();
      return;
    }
    originalHandleA.call(this);
  };

  const config = {
    type: Phaser.CANVAS,
    parent: 'game-wrap',
    width: W,
    height: H,
    pixelArt: true,
    antialias: false,
    backgroundColor: '#ffffff',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
    render: { pixelArt: true, antialias: false, roundPixels: true },
    scene: [GameScene]
  };

  document.fonts.ready.then(() => {
    try {
      new Phaser.Game(config);
    } catch (err) {
      $error.textContent = `Gagal memulai game: ${err.message}`;
      console.error(err);
    }
  });

  // Second canvas: same logical dimensions as the game screen.
  const controls = document.getElementById('controls');
  const ctx = controls.getContext('2d');
  const drawControls = () => {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    const key = (x, y, w, h, label) => {
      ctx.fillStyle = '#444'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#aaa'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
    };
    // D-pad
    key(29, 28, 22, 22, '↑'); key(7, 50, 22, 22, '←'); key(29, 50, 22, 22, '•');
    key(51, 50, 22, 22, '→'); key(29, 72, 22, 22, '↓');
    // A/B
    ctx.fillStyle = '#292929'; ctx.beginPath(); ctx.arc(126, 56, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#bbb'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.fillText('A', 126, 56);
    ctx.fillStyle = '#292929'; ctx.beginPath(); ctx.arc(101, 78, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#bbb'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText('B', 101, 78);
    ctx.fillStyle = '#999'; ctx.font = '7px monospace'; ctx.fillText('POLISODIUM', 80, 128);
  };
  drawControls();

  let activePointer = null;
  function pointFromEvent(event) {
    const rect = controls.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
  }
  function directionAt(x, y) {
    if (x >= 29 && x <= 51 && y >= 28 && y < 50) return 'up';
    if (x >= 7 && x <= 29 && y >= 50 && y <= 72) return 'left';
    if (x >= 51 && x <= 73 && y >= 50 && y <= 72) return 'right';
    if (x >= 29 && x <= 51 && y > 72 && y <= 94) return 'down';
    return null;
  }
  controls.addEventListener('pointerdown', event => {
    event.preventDefault();
    controls.setPointerCapture(event.pointerId);
    activePointer = event.pointerId;
    const { x, y } = pointFromEvent(event);
    const direction = directionAt(x, y);
    if (direction) app.setDirection(direction);
    else if (Math.hypot(x - 126, y - 56) <= 17) app.pressA();
    else if (Math.hypot(x - 101, y - 78) <= 15) app.pressB();
  });
  const release = event => {
    if (activePointer === event.pointerId) {
      activePointer = null;
      app.clearDirection();
    }
  };
  controls.addEventListener('pointerup', release);
  controls.addEventListener('pointercancel', release);
  controls.addEventListener('lostpointercapture', () => { activePointer = null; app.clearDirection(); });
})();
