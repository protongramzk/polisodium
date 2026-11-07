import { DB } from './src/db.js';
import storyFlow from './src/story.json' assert { type: 'json' };
import { dialogues as dialogueDB } from './src/dialogue_db.js';
import { GBCQuantizer } from './src/colorQuantizer.js';

const STORAGE_KEY = 'GAME_LAST_DIALOGUE_ID';

// =====================================================================
// UTILITIES
// =====================================================================
function findBlockIndexByDialogueId(dialogueId) {
    if (!dialogueId) return 0;
    const targetId = parseInt(dialogueId, 10);
    for (let i = 0; i < storyFlow.length; i++) {
        const block = storyFlow[i];
        if (block.type === 'dialogue' && targetId >= block.From && targetId <= block.to) {
            return i;
        }
    }
    return 0;
}

function findPreviousDialogueBlockIndex(battleBlockIndex) {
    for (let i = battleBlockIndex - 1; i >= 0; i--) {
        if (storyFlow[i].type === 'dialogue') {
            return i;
        }
    }
    return 0;
}

// =====================================================================
// [BATTLE LOGIC] BATTLE ENGINE CLASS (Murni Logika, Tanpa Scene)
// =====================================================================
class BattleEngine {
  constructor() {
    this.turnCount = 1;
    this.isOver = false;
    this.winner = null;
    this.units = [];
    this.logs = [];
  }

  initBattle(battleConfig = {}) {
    const rawParty = battleConfig.party || [];
    const rawEnemies = battleConfig.enemies || [];

    this.partyUnits = rawParty.map((item, idx) => {
      const id = typeof item === 'object' ? item.id : item;
      const moves = typeof item === 'object' ? (item.moveIds || item.moves || []) : [];
      const base = DB.getCharInstance(id);
      if (!base) console.warn(`[BattleEngine] Char ID ${id} tidak ditemukan di DB!`);
      return this._formatUnit(base, 'party', idx, moves);
    });

    this.enemyUnits = rawEnemies.map((item, idx) => {
      const id = typeof item === 'object' ? item.id : item;
      const moves = typeof item === 'object' ? (item.moveIds || item.moves || []) : [];
      const base = DB.getEnemyInstance(id);
      if (!base) console.warn(`[BattleEngine] Enemy ID ${id} tidak ditemukan di DB!`);
      return this._formatUnit(base, 'enemy', idx, moves);
    });

    this.units = [...this.partyUnits, ...this.enemyUnits];
  }

  _formatUnit(baseData, type, index, moves) {
    if (!baseData) {
      baseData = {
        id: 0, spriteIndex: 0, name: 'Unknown',
        stats: { max_hp: 50, current_hp: 50, atk: 10, def: 5, speed: 10, luck: 5 }
      };
    }
    return {
      ...baseData, unit_type: type, battle_index: index, equipped_moves: moves, buffs: [], statuses: [],
      stats: {
        ...baseData.stats, luck: baseData.stats?.luck || 5,
        current_hp: baseData.stats?.current_hp ?? baseData.stats?.max_hp ?? 50,
        current_sp: baseData.stats?.current_sp ?? baseData.stats?.max_sp ?? 0
      }
    };
  }

  getEffectiveStat(unit, statName) {
    let base = unit.stats[statName] || 0;
    unit.buffs.filter(b => b.stat === statName).forEach(b => base += b.val);
    return Math.max(1, base);
  }

  _checkHit(attacker, defender, move) {
    const atkSpeed = this.getEffectiveStat(attacker, 'speed');
    const defSpeed = this.getEffectiveStat(defender, 'speed');
    const baseAcc = move.accuracy ?? 100;
    const hitRate = Math.min(100, Math.max(10, baseAcc + (atkSpeed - defSpeed) * 0.5));
    return Math.random() * 100 <= hitRate;
  }

  _checkCrit(attacker, move) {
    const luck = this.getEffectiveStat(attacker, 'luck');
    const critChance = (luck * 1.2) + (move.crit_rate || 0);
    return Math.random() * 100 <= critChance;
  }

  calculateDamage(attacker, defender, move) {
    const atk = this.getEffectiveStat(attacker, 'atk');
    const def = this.getEffectiveStat(defender, 'def');
    const isCrit = this._checkCrit(attacker, move);
    const rawAtkPower = (atk * atk) / (atk + def * 0.75);
    const moveMultiplier = (move.power || 10) / 10;
    let baseDamage = rawAtkPower * moveMultiplier;
    if (isCrit) baseDamage *= 1.5;
    const variance = 0.92 + Math.random() * 0.16;
    const damage = Math.max(1, Math.round(baseDamage * variance));
    return { damage, isCrit };
  }

  processTurn(playerActions) {
    if (this.isOver) return { error: "Battle finished" };
    this.logs = [];
    this._processStatusEffects();

    const enemyActions = this._generateEnemyActions();
    const allActions = [...playerActions.map(a => ({ ...a, actor_type: 'party' })), ...enemyActions];

    const queue = allActions.map(act => {
      const unit = act.actor_type === 'party' ? this.partyUnits[act.actor_index] : this.enemyUnits[act.actor_index];
      const spd = unit ? this.getEffectiveStat(unit, 'speed') : 0;
      return { action: act, initiative: spd + Math.random() * 3 };
    }).sort((a, b) => b.initiative - a.initiative);

    for (const item of queue) {
      if (this.isOver) break;
      this._executeAction(item.action);
    }
    this._checkBattleStatus();

    return {
      turn: this.turnCount++, logs: this.logs,
      party_state: this.partyUnits.map(p => this._getUnitState(p)),
      enemy_state: this.enemyUnits.map(e => this._getUnitState(e)),
      is_over: this.isOver, winner: this.winner
    };
  }

  _executeAction(act) {
    const attacker = act.actor_type === 'party' ? this.partyUnits[act.actor_index] : this.enemyUnits[act.actor_index];
    if (!attacker || attacker.stats.current_hp <= 0) return;

    if (attacker.statuses.some(s => s.type === 'stun')) {
      this.logs.push({ type: 'stun', text: `💫 [${attacker.name}] tertegun!` });
      return;
    }
    const move = DB.getMove(act.move_id);
    if (!move) return;

    if (attacker.stats.current_sp !== undefined && move.sp_cost > 0) {
      if (attacker.stats.current_sp < move.sp_cost) {
        this.logs.push({ type: 'fail', text: `❌ [${attacker.name}] SP kurang!` });
        return;
      }
      attacker.stats.current_sp -= move.sp_cost;
    }

    const targetList = this._resolveTargets(act, move);
    for (const defender of targetList) {
      if (defender.stats.current_hp <= 0) continue;

      if (!this._checkHit(attacker, defender, move)) {
        this.logs.push({ type: 'miss', text: `💨 [${attacker.name}] -> ${move.name} -> MISSED!`, target: defender });
        continue;
      }

      const { damage, isCrit } = this.calculateDamage(attacker, defender, move);
      defender.stats.current_hp = Math.max(0, defender.stats.current_hp - damage);
      const critTag = isCrit ? " 💥 CRITICAL!" : "";

      this.logs.push({
        type: 'damage', text: `⚔️ [${attacker.name}] -> ${move.name} -> [${defender.name}] (${damage} Dmg)${critTag}`,
        attacker, target: defender, damage, isCrit
      });

      if (move.effect && defender.stats.current_hp > 0) this._applyMoveEffect(move.effect, defender);
      this._checkBattleStatus();
      if (this.isOver) break;
    }
  }

  _resolveTargets(act, move) {
    const isPartyAttacker = act.actor_type === 'party';
    const enemyPool = isPartyAttacker ? this.enemyUnits : this.partyUnits;
    const allyPool = isPartyAttacker ? this.partyUnits : this.enemyUnits;

    if (move.target_type === 'all_enemies') return enemyPool.filter(u => u.stats.current_hp > 0);
    if (move.target_type === 'all_allies') return allyPool.filter(u => u.stats.current_hp > 0);

    const targetPool = act.target_type === 'enemy' ? enemyPool : allyPool;
    const target = targetPool[act.target_index];
    return target ? [target] : [];
  }

  _generateEnemyActions() {
    return this.enemyUnits.filter(e => e.stats.current_hp > 0).map(e => {
      const aliveParty = this.partyUnits.filter(p => p.stats.current_hp > 0);
      const randomTarget = aliveParty[Math.floor(Math.random() * aliveParty.length)];
      const moves = e.equipped_moves.length ? e.equipped_moves : ['move_tinju'];
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      return { actor_type: 'enemy', actor_index: e.battle_index, move_id: randomMove, target_type: 'enemy', target_index: randomTarget ? randomTarget.battle_index : 0 };
    });
  }

  _processStatusEffects() {
    for (const unit of this.units) {
      if (unit.stats.current_hp <= 0) continue;
      unit.statuses.forEach(s => {
        if (s.type === 'poison') {
          const dotDmg = Math.round(unit.stats.max_hp * 0.08);
          unit.stats.current_hp = Math.max(0, unit.stats.current_hp - dotDmg);
          this.logs.push({ type: 'status_damage', text: `🤢 [${unit.name}] Poison! (-${dotDmg} HP)` });
        }
        s.duration -= 1;
      });
      unit.statuses = unit.statuses.filter(s => s.duration > 0);
      unit.buffs.forEach(b => b.turns -= 1);
      unit.buffs = unit.buffs.filter(b => b.turns > 0);
    }
  }

  _applyMoveEffect(effect, target) {
    if (Math.random() * 100 > (effect.chance || 100)) return;
    if (effect.type === 'buff') {
      target.buffs.push({ stat: effect.stat, val: effect.val, turns: effect.turns });
      this.logs.push({ type: 'buff', text: `✨ [${target.name}] Buff ${effect.stat.toUpperCase()} (+${effect.val})!` });
    } else {
      target.statuses.push({ type: effect.type, duration: effect.duration });
      this.logs.push({ type: 'status', text: `⚠️ [${target.name}] Status [${effect.type.toUpperCase()}]!` });
    }
  }

  _getUnitState(u) {
    return { index: u.battle_index, name: u.name, hp: u.stats.current_hp, max_hp: u.stats.max_hp, sp: u.stats.current_sp, max_sp: u.stats.max_sp, statuses: u.statuses.map(s => s.type) };
  }

  _checkBattleStatus() {
    const partyAlive = this.partyUnits.some(p => p.stats.current_hp > 0);
    const enemyAlive = this.enemyUnits.some(e => e.stats.current_hp > 0);
    if (!partyAlive) { this.isOver = true; this.winner = 'enemies'; }
    else if (!enemyAlive) { this.isOver = true; this.winner = 'party'; }
  }
}

// =====================================================================
// [VN LOGIC] VN ENGINE HELPER CLASS (Murni Logika Text, Tanpa Scene)
// =====================================================================
class VNEngine {
    constructor(scene) {
        this.scene = scene; // GameScene instance
        this.width = 144;
        this.height = 160;
        this.dialogueDB = [];
        this.storyFlow = [];
        
        this.flowIndex = 0;
        this.dialogues = [];
        this.dialogueIndex = 0;

        this.active = false;
        this.typing = false;
        this.typingSpeed = 25;
        this.typingTimer = null;
        this.arrowTween = null;

        this.sceneObjects = [];
        this.currentBgmKey = null;
        this.bgm = null;

        this.maxCharsPerLine = 17;
        this.maxLinesPerPage = 2;
    }

    startFlow(storyFlow, dialogueDB) {
        this.storyFlow = storyFlow;
        this.dialogueDB = dialogueDB;
        this.flowIndex = 0;
        this.active = true;
        this.createDialogueUI();
        this.processCurrentBlock();
    }

    processCurrentBlock() {
        if (!this.active) return;
        if (this.flowIndex >= this.storyFlow.length) {
            this.finish();
            return;
        }

        const block = this.storyFlow[this.flowIndex];
        if (block.type === 'dialogue') {
            const rawDialogues = this.dialogueDB.filter(d => d.id >= block.From && d.id <= block.to);
            this.dialogues = this.processDialogues(rawDialogues);
            this.dialogueIndex = 0;
            
            if (block.visual) this.updateVisual(`map_${block.visual}`);
            if (block.music) this.playBGM(`music_${block.music}`);
            
            this.nextDialogue();
        }
    }

    updateVisual(textureKey) {
        if (!this.scene.textures.exists(textureKey)) {
            console.warn(`[VNEngine] Texture ${textureKey} tidak ditemukan!`);
            return;
        }
        if (this.background) {
            this.background.setTexture(textureKey);
        } else {
            this.background = this.scene.add.image(72, 0, textureKey).setOrigin(0.5, 0).setDisplaySize(144, 96).setDepth(1);
            this.sceneObjects.push(this.background);
        }
    }

    playBGM(musicKey) {
        if (this.currentBgmKey === musicKey && this.bgm && this.bgm.isPlaying) return;
        if (this.bgm) { this.bgm.stop(); this.bgm.destroy(); }
        
        this.currentBgmKey = musicKey;
        if (this.scene.cache.audio.exists(musicKey)) {
            this.bgm = this.scene.sound.add(musicKey, { loop: true, volume: 0.75 });
            this.bgm.play();
        }
    }

    processDialogues(rawDialogues) {
        const formattedList = [];
        rawDialogues.forEach(item => {
            const words = (item.text || "").split(" ");
            let lines = [], currentLine = "";
            words.forEach(word => {
                if ((currentLine + (currentLine ? " " : "") + word).length <= this.maxCharsPerLine) {
                    currentLine += (currentLine ? " " : "") + word;
                } else {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                }
            });
            if (currentLine) lines.push(currentLine);
            for (let i = 0; i < lines.length; i += this.maxLinesPerPage) {
                formattedList.push({ id: item.id, speaker: item.speaker || "", text: lines.slice(i, i + this.maxLinesPerPage).join("\n") });
            }
        });
        return formattedList;
    }
    createDialogueUI() {
        this.outerBox = this.scene.add.rectangle(72, 128, 140, 58, 0xffffff).setDepth(10).setStrokeStyle(1, 0x000000);
        this.innerBox = this.scene.add.rectangle(72, 128, 136, 54, 0xffffff).setDepth(10).setStrokeStyle(1, 0x333333);
        this.speakerText = this.scene.add.text(8, 103, "", { fontFamily: "Silkscreen, monospace", fontSize: "8px", color: "#000000", backgroundColor: "#ffffff", padding: { x: 2, y: 1 } }).setDepth(12);
        this.dialogueText = this.scene.add.text(8, 114, "", { fontFamily: "Silkscreen, monospace", fontSize: "8px", color: "#000000", lineSpacing: 2, wordWrap: { width: 128 } }).setDepth(11);
        
        // 1. Tentukan posisi dasar panah (misal di y: 144)
        this.nextText = this.scene.add.text(130, 144, "", { 
            fontFamily: "Silkscreen, monospace", 
            fontSize: "8px", 
            color: "#000000" 
        }).setDepth(12).setVisible(false);

        // 2. Buat tween dengan selisih sangat kecil (dari 144 turun ke 146, lalu balik lagi)
        this.arrowTween = this.scene.tweens.add({ 
            targets: this.nextText, 
            y: 146,             // Target turun sedikit saja (selisih 2 pixel)
            duration: 300,      // Kecepatan kedipan/gerakan
            yoyo: true,         // Membalikkan animasi kembali ke posisi awal (144)
            repeat: -1,         // Looping terus-menerus
            paused: true 
        });

        this.sceneObjects.push(this.outerBox, this.innerBox, this.speakerText, this.dialogueText, this.nextText);
    }


    nextDialogue() {
        if (!this.active) return;
        if (this.typing) { this.completeTyping(); return; }
        if (this.dialogueIndex >= this.dialogues.length) {
            this.flowIndex++;
            this.processCurrentBlock();
            return;
        }

        const dialogue = this.dialogues[this.dialogueIndex];
        this.nextText.setVisible(false);
        if (this.arrowTween) this.arrowTween.pause();

        this.speakerText.setText(`[${dialogue.speaker ? dialogue.speaker.toUpperCase() : "NARRATOR"}]`);
        this.dialogueText.setText("");
        this.dialogueIndex++;
        this.startTyping(dialogue.text || "");
    }

    startTyping(text) {
        if (!text) { this.onTypingComplete(); return; }
        this.typing = true;
        let charIndex = 0;
        if (this.typingTimer) this.typingTimer.remove();
        
        this.typingTimer = this.scene.time.addEvent({
            delay: this.typingSpeed, repeat: text.length - 1,
            callback: () => {
                charIndex++;
                this.dialogueText.setText(text.substring(0, charIndex));
                if (charIndex >= text.length) this.onTypingComplete();
            }
        });
    }

    completeTyping() {
        if (!this.typing) return;
        if (this.typingTimer) { this.typingTimer.remove(); this.typingTimer = null; }
        if (this.dialogues[this.dialogueIndex - 1]) this.dialogueText.setText(this.dialogues[this.dialogueIndex - 1].text || "");
        this.onTypingComplete();
    }

    onTypingComplete() {
        this.typing = false;
        this.typingTimer = null;
        this.nextText.setVisible(true);
        if (this.arrowTween) this.arrowTween.restart();
    }

    finish() {
        this.active = false;
        if (this.speakerText) this.speakerText.setText("[END]");
        if (this.dialogueText) this.dialogueText.setText("Cerita Selesai.");
    }

    destroy() {
        if (this.typingTimer) this.typingTimer.remove();
        if (this.arrowTween) this.arrowTween.stop();
        this.active = false;
        this.sceneObjects.forEach(obj => obj && obj.destroy && obj.destroy());
        this.sceneObjects = [];
        if (this.bgm) { this.bgm.stop(); this.bgm.destroy(); }
    }
}


// =====================================================================
// SCENE 1: INTRO SCENE (Ping-Pong Video GBC Filter)
// =====================================================================
class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntroScene' });
        this.START_LOOP = 21;
        this.END_LOOP = 26;
        this.FPS = 30;
        this.FRAME = 1 / this.FPS;
        this.mode = 'INITIAL';
        this.isSceneActive = false;
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        this.isSceneActive = true;
        this.mode = 'INITIAL';
        this.quantizer = new GBCQuantizer(144, 160);

        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = 144;
        this.offscreenCanvas.height = 160;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        this.offscreenCtx.imageSmoothingEnabled = false; 

        if (this.textures.exists('quantized_video')) this.textures.remove('quantized_video');
        this.outputTexture = this.textures.createCanvas('quantized_video', 144, 160);
        this.outputCtx = this.outputTexture.context;
        this.outputCtx.imageSmoothingEnabled = false; 

        this.add.image(72, 80, 'quantized_video').setDisplaySize(144, 160);

        this.videoEl = document.createElement('video');
        this.videoEl.src = './src/intro.mp4';
        this.videoEl.muted = true;
        this.videoEl.playsInline = true;
        this.videoEl.preload = 'auto';

        this.startText = this.add.text(72, 140, 'TEKAN A / ENTER', { fontFamily: 'Silkscreen, monospace', fontSize: '7px', color: '#ffff00', backgroundColor: '#00000088', padding: { x: 4, y: 2 } }).setOrigin(0.5).setDepth(10).setVisible(false);
        this.blinkTween = this.tweens.add({ targets: this.startText, alpha: 0.2, duration: 500, yoyo: true, repeat: -1, paused: true });

        this.videoEl.addEventListener('loadeddata', () => {
            this.videoEl.currentTime = 0;
            this.videoEl.play().catch(err => console.warn('Autoplay blocked:', err));
        }, { once: true });

        const startGame = () => { if (this.isSceneActive) this.cleanupAndStartGame(); };
        this.input.keyboard.once('keydown-ENTER', startGame);
        this.input.keyboard.once('keydown-SPACE', startGame);
        this.input.once('pointerdown', startGame);
        if (this.game.events) this.game.events.once('BTN_A', startGame);
    }

    update() {
        if (!this.videoEl || !this.isSceneActive) return;

        if (this.videoEl.readyState >= 2) {
            this.offscreenCtx.drawImage(this.videoEl, 0, 0, 144, 160);
            const rawImageData = this.offscreenCtx.getImageData(0, 0, 144, 160);
            const processedImageData = this.quantizer.processImageData(rawImageData);
            this.outputCtx.putImageData(processedImageData, 0, 0);
            this.outputTexture.refresh();
        }

        if (this.mode === 'INITIAL') {
            if (this.videoEl.currentTime >= this.END_LOOP) {
                this.mode = 'REVERSE';
                this.videoEl.pause();
                this.startText.setVisible(true);
                if (this.blinkTween) this.blinkTween.resume();
            }
        } 
        else if (this.mode === 'FORWARD') {
            if (this.videoEl.currentTime >= this.END_LOOP) {
                this.mode = 'REVERSE';
                this.videoEl.pause();
            }
        } 
        else if (this.mode === 'REVERSE') {
            this.videoEl.currentTime = Math.max(this.START_LOOP, this.videoEl.currentTime - this.FRAME);
            if (this.videoEl.currentTime <= this.START_LOOP + 0.001) {
                this.videoEl.currentTime = this.START_LOOP;
                this.mode = 'FORWARD';
                this.videoEl.play();
            }
        }
    }
cleanupAndStartGame() {
    if (!this.isSceneActive) return;
    this.isSceneActive = false;

    // 1. Bersihkan Video Intro Native
    if (this.videoEl) {
        this.videoEl.pause();
        this.videoEl.removeAttribute('src');
        this.videoEl.load();
        this.videoEl = null;
    }

    // 2. Tempelkan CSS Border Wave ke Canvas
    const canvasEl = this.game.canvas;
    if (canvasEl) {
        canvasEl.classList.add('wave-border');

        // Hilangkan efek border secara otomatis setelah 4 + random (0-2) detik
        const durationMs = (4 + Math.random() * 2) * 1600;
        setTimeout(() => {
            canvasEl.classList.remove('wave-border');
        }, durationMs);
    }

    // 3. LANGSUNG START GAME SCENE TANPA DELAY!
    this.scene.start('GameScene');
}

}


// =====================================================================
// SCENE 2: GAME SCENE (UNIFIED SCENE: VN + BATTLE)
// =====================================================================
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.currentBlockIdx = 0;
        this.state = 'INIT'; // 'VN', 'BATTLE'
    }

    preload() {
        // Preload Map Visuals
        for (let i = 1; i <= 36; i++) { this.load.image(`map_${i}`, `/two/map/${i}.jpg`); }
        
        // Preload BGM
        this.load.audio('music_santai', '/two/music/santai.wav');
        this.load.audio('music_santai_2', '/two/music/santai_2.wav');
        this.load.audio('music_konflik', '/two/music/konflik.wav');
        this.load.audio('music_diskusi', '/two/music/diskusi.wav');
        this.load.audio('music_misteri', '/two/music/misteri.wav');

        // Preload Battle Spritesheet
        this.load.spritesheet('char_spritesheet', '/two/char.png', { frameWidth: 32, frameHeight: 32 });
    }

    init(data) {
        if (data && data.resumeBlockIdx !== undefined) {
            this.currentBlockIdx = data.resumeBlockIdx;
        } else {
            const savedDialogueId = localStorage.getItem(STORAGE_KEY);
            this.currentBlockIdx = findBlockIndexByDialogueId(savedDialogueId);
        }
    }

    create() {
        this.cameras.main.setBackgroundColor('#000000');
        this.setupGlobalControls();
        this.executeCurrentBlock();
    }

    setupGlobalControls() {
        const handleConfirm = () => {
            if (this.state === 'VN' && this.vnEngine && this.vnEngine.active) {
                this.vnEngine.nextDialogue();
            } else if (this.state === 'BATTLE') {
                this._battleHandleConfirm();
            }
        };

        const handleCancel = () => { if (this.state === 'BATTLE') this._battleHandleCancel(); };
        const handleUp = () => { if (this.state === 'BATTLE') this._battleHandleNav(-1); };
        const handleDown = () => { if (this.state === 'BATTLE') this._battleHandleNav(1); };

        this.input.keyboard.on('keydown-ENTER', handleConfirm);
        this.input.keyboard.on('keydown-SPACE', handleConfirm);
        this.input.keyboard.on('keydown-ESC', handleCancel);
        this.input.keyboard.on('keydown-UP', handleUp);
        this.input.keyboard.on('keydown-DOWN', handleDown);

        if (this.game.events) {
            this.game.events.on('BTN_A', handleConfirm);
            this.game.events.on('BTN_B', handleCancel);
            this.game.events.on('PAD_UP', handleUp);
            this.game.events.on('PAD_DOWN', handleDown);
        }
    }

    executeCurrentBlock() {
        this._clearSceneObjects();

        if (this.currentBlockIdx >= storyFlow.length) {
            localStorage.removeItem(STORAGE_KEY);
            this.scene.start('EndingScene');
            return;
        }

        const block = storyFlow[this.currentBlockIdx];

        if (block.type === 'dialogue') {
            this.state = 'VN';
            this.cameras.main.setBackgroundColor('#000000');
            const rawDialogues = dialogueDB.filter(d => d.id >= block.From && d.id <= block.to);
            if (rawDialogues.length > 0) localStorage.setItem(STORAGE_KEY, rawDialogues[0].id);

            this.vnEngine = new VNEngine(this);
            this.vnEngine.startFlow([block], dialogueDB);
            
            this.vnEngine.finish = () => {
                this.currentBlockIdx++;
                this.executeCurrentBlock();
            };
        } 
        else if (block.type === 'battle') {
            this.state = 'BATTLE';
            this.cameras.main.setBackgroundColor('#ffffff');
            const battleConfig = DB.BATTLE ? DB.BATTLE[block.battleId] : null;
            this._startBattleUI(battleConfig);
        }
    }

    _clearSceneObjects() {
        if (this.vnEngine) { this.vnEngine.destroy(); this.vnEngine = null; }
        if (this.battleObjects) {
            this.battleObjects.forEach(obj => obj && obj.destroy && obj.destroy());
            this.battleObjects = [];
        }
    }

    // =================================================================
    // [BATTLE UI SECTION] INTEGRATED INSIDE GAME SCENE
    // =================================================================
    _startBattleUI(battleConfig) {
        this.battleObjects = [];
        this.battleEngine = new BattleEngine();
        this.battleEngine.initBattle(battleConfig || {
            party: [{ id: 1, moveIds: ["move_tinju", "move_ranting_kayu"] }],
            enemies: [{ id: 4, moveIds: ["move_tinju"] }]
        });

        this.battleState = 'TARGET_SELECT';
        this.currentPartyTurnIdx = 0;
        this.selectedTargetIdx = 0;
        this.selectedMoveIdx = 0;
        this.playerTurnActions = [];

        this._createBattleSprites();
        this._createBattleDialog();
        this._createBattleCursors();

        this._battleStartPartyInputPhase();
    }

    _createBattleSprites() {
        this.enemySprites = [];
        this.partySprites = [];

        this.battleEngine.enemyUnits.forEach((enemy, idx) => {
            const x = 24, y = 16 + idx * 28;
            const sprite = this.add.sprite(x, y, 'char_spritesheet', Math.max(0, (enemy.spriteIndex || 1) - 1)).setDisplaySize(24, 24);
            const label = this.add.text(x - 12, y + 10, enemy.name.substring(0, 3), { fontFamily: 'Silkscreen', fontSize: '7px', color: '#ffcdd2' });
            this.enemySprites.push({ sprite, label, x, y, unit: enemy });
            this.battleObjects.push(sprite, label);
        });

        this.battleEngine.partyUnits.forEach((party, idx) => {
            const x = 120, y = 16 + idx * 28;
            const sprite = this.add.sprite(x, y, 'char_spritesheet', Math.max(0, (party.spriteIndex || 1) - 1)).setDisplaySize(24, 24);
            const label = this.add.text(x - 10, y + 10, party.name.substring(0, 3), { fontFamily: 'Silkscreen', fontSize: '7px', color: '#bbdefb' });
            this.partySprites.push({ sprite, label, x, y, unit: party });
            this.battleObjects.push(sprite, label);
        });
    }

    _createBattleDialog() {
        const box = this.add.graphics();
        box.fillStyle(0xffffff, 1).fillRoundedRect(3, 90, 138, 67, 3);
        box.lineStyle(2, 0x000000, 1).strokeRoundedRect(2, 89, 140, 69, 4);
        box.lineStyle(1, 0xcccccc, 1).lineBetween(5, 120, 139, 120).lineBetween(70, 93, 70, 118);
        this.battleObjects.push(box);

        this.playerStatText = this.add.text(6, 92, '', { fontFamily: 'Silkscreen', fontSize: '8px', color: '#000000' });
        this.enemyStatText = this.add.text(73, 92, '', { fontFamily: 'Silkscreen', fontSize: '8px', color: '#000000' });
        this.dialogMsgText = this.add.text(6, 123, '', { fontFamily: 'Silkscreen', fontSize: '8px', color: '#000000', wordWrap: { width: 132 } });
        this.battleObjects.push(this.playerStatText, this.enemyStatText, this.dialogMsgText);

        this.moveOptionTexts = [];
        for (let i = 0; i < 4; i++) {
            const t = this.add.text(14, 123 + i * 10, '', { fontFamily: 'Silkscreen', fontSize: '7px', color: '#000000' });
            this.moveOptionTexts.push(t);
            this.battleObjects.push(t);
        }
    }

    _createBattleCursors() {
        this.targetPointer = this.add.text(0, 0, '>', { fontFamily: 'Silkscreen', fontSize: '8px', color: '#ffff00' });
        this.menuCursor = this.add.text(6, 123, '>', { fontFamily: 'Silkscreen', fontSize: '8px', color: '#000000' }).setVisible(false);
        this.battleObjects.push(this.targetPointer, this.menuCursor);
    }

    _battleUpdateDialogStatHUD() {
        const player = this.battleEngine.partyUnits[this.currentPartyTurnIdx];
        const enemy = this.battleEngine.enemyUnits[this.selectedTargetIdx];
        this.playerStatText.setText(player && player.stats.current_hp > 0 ? `${player.name.substring(0, 6)}\nHP ${player.stats.current_hp}/${player.stats.max_hp}\nSP ${player.stats.current_sp}/${player.stats.max_sp}` : '');
        this.enemyStatText.setText(enemy && enemy.stats.current_hp > 0 ? `${enemy.name.substring(0, 6)}\nHP ${enemy.stats.current_hp}/${enemy.stats.max_hp}` : 'TARGET KO');
    }

    _battleTypeText(fullText) {
        return new Promise(resolve => {
            if (this.battleTypingTimer) this.battleTypingTimer.remove();
            this.battleIsTyping = true;
            this.battleCurrentFullText = fullText;
            this.dialogMsgText.setText('').setVisible(true);

            let currentLength = 0;
            this.battleTypingTimer = this.time.addEvent({
                delay: 20, loop: true,
                callback: () => {
                    currentLength++;
                    this.dialogMsgText.setText(fullText.substring(0, currentLength));
                    if (currentLength >= fullText.length) {
                        this.battleIsTyping = false;
                        this.battleTypingTimer.remove();
                        resolve();
                    }
                }
            });
            this.battleResolveTyping = resolve;
        });
    }

    _battleSkipTyping() {
        if (!this.battleIsTyping) return false;
        if (this.battleTypingTimer) this.battleTypingTimer.remove();
        this.dialogMsgText.setText(this.battleCurrentFullText);
        this.battleIsTyping = false;
        if (this.battleResolveTyping) this.battleResolveTyping();
        return true;
    }

    _battleStartPartyInputPhase() {
        while (this.currentPartyTurnIdx < this.battleEngine.partyUnits.length && this.battleEngine.partyUnits[this.currentPartyTurnIdx].stats.current_hp <= 0) {
            this.currentPartyTurnIdx++;
        }
        if (this.currentPartyTurnIdx >= this.battleEngine.partyUnits.length) {
            this._battleExecuteEngineTurn();
            return;
        }

        this.battleState = 'TARGET_SELECT';
        this.selectedTargetIdx = this.battleEngine.enemyUnits.findIndex(e => e.stats.current_hp > 0);
        this._battleRenderTargetSelection();
    }

    _battleRenderTargetSelection() {
        this.moveOptionTexts.forEach(t => t.setText(''));
        this.menuCursor.setVisible(false);
        this._battleUpdateDialogStatHUD();
        
        const enemySprite = this.enemySprites[this.selectedTargetIdx];
        if (enemySprite) this.targetPointer.setPosition(enemySprite.x + 8, enemySprite.y - 4).setVisible(true);

        const char = this.battleEngine.partyUnits[this.currentPartyTurnIdx];
        this._battleTypeText(`[${char.name}] Pilih Target Musuh!`);
    }

    _battleRenderMoveSelection() {
        this.battleState = 'MOVE_SELECT';
        this.targetPointer.setVisible(false);
        this.dialogMsgText.setVisible(false);

        const char = this.battleEngine.partyUnits[this.currentPartyTurnIdx];
        this.moveOptionTexts.forEach((t, idx) => {
            if (idx < char.equipped_moves.length) {
                const move = DB.getMove(char.equipped_moves[idx]);
                t.setText(`${(move ? move.name : char.equipped_moves[idx]).substring(0, 11)} (${move ? move.sp_cost : 0}SP)`);
            } else { t.setText(''); }
        });

        this.selectedMoveIdx = 0;
        this.menuCursor.setPosition(6, 123 + this.selectedMoveIdx * 10).setVisible(true);
    }

    _battleHandleNav(dir) {
        if (this.battleState === 'TARGET_SELECT') {
            const enemies = this.battleEngine.enemyUnits;
            let next = this.selectedTargetIdx;
            for (let i = 0; i < enemies.length; i++) {
                next = (next + dir + enemies.length) % enemies.length;
                if (enemies[next].stats.current_hp > 0) { this.selectedTargetIdx = next; break; }
            }
            if (this.enemySprites[this.selectedTargetIdx]) this.targetPointer.setPosition(this.enemySprites[this.selectedTargetIdx].x + 8, this.enemySprites[this.selectedTargetIdx].y - 4);
            this._battleUpdateDialogStatHUD();
        } 
        else if (this.battleState === 'MOVE_SELECT') {
            const max = this.battleEngine.partyUnits[this.currentPartyTurnIdx].equipped_moves.length;
            if (max > 0) {
                this.selectedMoveIdx = (this.selectedMoveIdx + dir + max) % max;
                this.menuCursor.setPosition(6, 123 + this.selectedMoveIdx * 10);
            }
        }
    }

    _battleHandleConfirm() {
        if (this._battleSkipTyping()) return;
        
        if (this.battleState === 'TARGET_SELECT') {
            this._battleRenderMoveSelection();
        } else if (this.battleState === 'MOVE_SELECT') {
            const char = this.battleEngine.partyUnits[this.currentPartyTurnIdx];
            this.playerTurnActions.push({ actor_index: this.currentPartyTurnIdx, move_id: char.equipped_moves[this.selectedMoveIdx], target_type: 'enemy', target_index: this.selectedTargetIdx });
            this.currentPartyTurnIdx++;
            this._battleStartPartyInputPhase();
        } else if (this.battleState === 'GAME_OVER') {
            this._battleEndFlow(this.battleEngine.winner === 'party');
        }
    }

    _battleHandleCancel() {
        if (this.battleState === 'MOVE_SELECT') this._battleRenderTargetSelection();
    }

    async _battleExecuteEngineTurn() {
        this.battleState = 'PROCESSING';
        this.targetPointer.setVisible(false);
        this.menuCursor.setVisible(false);
        this.moveOptionTexts.forEach(t => t.setText(''));

        const result = this.battleEngine.processTurn(this.playerTurnActions);

        for (const logItem of result.logs) {
            const shortText = logItem.text.replace(/ memakai /g, '->').replace(/ ke /g, ' ').replace(/ (Damage: )/g, ' Dmg:');
            if (logItem.type === 'damage' && logItem.damage > 0) this.cameras.main.shake(100, 0.008);
            
            this.partySprites.forEach((ps, i) => ps.sprite.setAlpha(this.battleEngine.partyUnits[i].stats.current_hp <= 0 ? 0.3 : 1));
            this.enemySprites.forEach((es, i) => es.sprite.setAlpha(this.battleEngine.enemyUnits[i].stats.current_hp <= 0 ? 0.2 : 1));
            
            await this._battleTypeText(shortText);
            await new Promise(r => setTimeout(r, 700));
        }

        if (result.is_over) {
            this.battleState = 'GAME_OVER';
            await this._battleTypeText(result.winner === 'party' ? `🏆 VICTORY!\nMusuh Tumbang!` : `☠️ DEFEAT!\nTim Kamu Gugur!`);
            return;
        }

        this.playerTurnActions = [];
        this.currentPartyTurnIdx = 0;
        this._battleStartPartyInputPhase();
    }

    _battleEndFlow(isWin) {
        if (isWin) {
            this.currentBlockIdx++;
            this.executeCurrentBlock(); // Lanjut ke blok dialog VN
        } else {
            this.currentBlockIdx = findPreviousDialogueBlockIndex(this.currentBlockIdx);
            this.executeCurrentBlock(); // Ulang dari checkpoint dialog
        }
    }
}


// =====================================================================
// SCENE 3: ENDING SCENE (Game Completed)
// =====================================================================
class EndingScene extends Phaser.Scene {
    constructor() { super({ key: 'EndingScene' }); }
    create() {
        this.cameras.main.setBackgroundColor('#050508');
        this.add.text(72, 40, 'THE END', { fontFamily: 'Silkscreen, monospace', fontSize: '12px', color: '#ffff00' }).setOrigin(0.5);
        this.add.text(72, 75, 'Terima kasih telah\nmemainkan petualangan\nMuara Teweh - Sampit!', { fontFamily: 'Silkscreen, monospace', fontSize: '6px', color: '#ffffff', align: 'center', lineSpacing: 3 }).setOrigin(0.5);
        
        const restartBtn = this.add.text(72, 130, 'TEKAN A: RESTART', { fontFamily: 'Silkscreen, monospace', fontSize: '7px', color: '#00ff00' }).setOrigin(0.5);
        this.tweens.add({ targets: restartBtn, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });

        const resetGame = () => { localStorage.removeItem(STORAGE_KEY); this.scene.start('IntroScene'); };
        this.input.keyboard.once('keydown-ENTER', resetGame);
        this.input.keyboard.once('keydown-SPACE', resetGame);
        if (this.game.events) this.game.events.once('BTN_A', resetGame);
    }
}

// =====================================================================
// PHASER CONFIGURATION & BOOTSTRAP
// =====================================================================
const config = {
    type: Phaser.AUTO,
    width: 144,
    height: 160,
    parent: 'game-container',
    backgroundColor: '#050508',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [IntroScene, GameScene, EndingScene]
};

document.fonts.load('8px Silkscreen').then(() => {
    const game = new Phaser.Game(config);
    const bindControl = (elementId, eventName) => {
        const btn = document.getElementById(elementId);
        if (!btn) return;
        const trigger = (e) => {
            e.preventDefault();
            btn.classList.add('active');
            game.events.emit(eventName);
            setTimeout(() => btn.classList.remove('active'), 120);
        };
        btn.addEventListener('touchstart', trigger, { passive: false });
        btn.addEventListener('mousedown', trigger);
    };
    bindControl('btn-up', 'PAD_UP'); bindControl('btn-down', 'PAD_DOWN');
    bindControl('btn-left', 'PAD_LEFT'); bindControl('btn-right', 'PAD_RIGHT');
    bindControl('btn-a', 'BTN_A'); bindControl('btn-b', 'BTN_B');
});
