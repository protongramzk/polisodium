import { DB } from './db.js';

export class BattleEngine {
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
      ...baseData,
      unit_type: type,
      battle_index: index,
      equipped_moves: moves,
      buffs: [],
      statuses: [],
      stats: {
        ...baseData.stats,
        luck: baseData.stats?.luck || 5,
        current_hp: baseData.stats?.current_hp ?? baseData.stats?.max_hp ?? 50,
        current_sp: baseData.stats?.current_sp ?? baseData.stats?.max_sp ?? 0
      }
    };
  }

  getEffectiveStat(unit, statName) {
    let base = unit.stats[statName] || 0;
    const statBuffs = unit.buffs.filter(b => b.stat === statName);

    for (const b of statBuffs) base += b.val;

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
    const allActions = [
      ...playerActions.map(a => ({ ...a, actor_type: 'party' })),
      ...enemyActions
    ];

    const queue = allActions
      .map(act => {
        const unit = act.actor_type === 'party'
          ? this.partyUnits[act.actor_index]
          : this.enemyUnits[act.actor_index];

        const spd = unit ? this.getEffectiveStat(unit, 'speed') : 0;

        return { action: act, initiative: spd + Math.random() * 3 };
      })
      .sort((a, b) => b.initiative - a.initiative);

    for (const item of queue) {
      if (this.isOver) break;
      this._executeAction(item.action);
    }

    this._checkBattleStatus();

    return {
      turn: this.turnCount++,
      logs: this.logs,
      party_state: this.partyUnits.map(p => this._getUnitState(p)),
      enemy_state: this.enemyUnits.map(e => this._getUnitState(e)),
      is_over: this.isOver,
      winner: this.winner
    };
  }

  _executeAction(act) {
    const attacker = act.actor_type === 'party'
      ? this.partyUnits[act.actor_index]
      : this.enemyUnits[act.actor_index];

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
        this.logs.push({
          type: 'miss',
          text: `💨 [${attacker.name}] -> ${move.name} -> MISSED!`,
          target: defender
        });
        continue;
      }

      const { damage, isCrit } = this.calculateDamage(attacker, defender, move);

      defender.stats.current_hp = Math.max(0, defender.stats.current_hp - damage);

      const critTag = isCrit ? " 💥 CRITICAL!" : "";

      this.logs.push({
        type: 'damage',
        text: `⚔️ [${attacker.name}] -> ${move.name} -> [${defender.name}] (${damage} Dmg)${critTag}`,
        attacker,
        target: defender,
        damage,
        isCrit
      });

      if (move.effect && defender.stats.current_hp > 0) {
        this._applyMoveEffect(move.effect, defender);
      }

      this._checkBattleStatus();
      if (this.isOver) break;
    }
  }

  _resolveTargets(act, move) {
    const isPartyAttacker = act.actor_type === 'party';
    const enemyPool = isPartyAttacker ? this.enemyUnits : this.partyUnits;
    const allyPool = isPartyAttacker ? this.partyUnits : this.enemyUnits;

    if (move.target_type === 'all_enemies')
      return enemyPool.filter(u => u.stats.current_hp > 0);

    if (move.target_type === 'all_allies')
      return allyPool.filter(u => u.stats.current_hp > 0);

    const targetPool = act.target_type === 'enemy' ? enemyPool : allyPool;
    const target = targetPool[act.target_index];

    return target ? [target] : [];
  }

  _generateEnemyActions() {
    return this.enemyUnits
      .filter(e => e.stats.current_hp > 0)
      .map(e => {
        const aliveParty = this.partyUnits.filter(p => p.stats.current_hp > 0);
        const randomTarget = aliveParty[Math.floor(Math.random() * aliveParty.length)];

        const moves = e.equipped_moves.length
          ? e.equipped_moves
          : ['move_tinju'];

        const randomMove = moves[Math.floor(Math.random() * moves.length)];

        return {
          actor_type: 'enemy',
          actor_index: e.battle_index,
          move_id: randomMove,
          target_type: 'enemy',
          target_index: randomTarget ? randomTarget.battle_index : 0
        };
      });
  }

  _processStatusEffects() {
    for (const unit of this.units) {
      if (unit.stats.current_hp <= 0) continue;

      unit.statuses.forEach(s => {
        if (s.type === 'poison') {
          const dotDmg = Math.round(unit.stats.max_hp * 0.08);

          unit.stats.current_hp = Math.max(0, unit.stats.current_hp - dotDmg);

          this.logs.push({
            type: 'status_damage',
            text: `🤢 [${unit.name}] Poison! (-${dotDmg} HP)`
          });
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
      target.buffs.push({
        stat: effect.stat,
        val: effect.val,
        turns: effect.turns
      });

      this.logs.push({
        type: 'buff',
        text: `✨ [${target.name}] Buff ${effect.stat.toUpperCase()} (+${effect.val})!`
      });
    } else {
      target.statuses.push({
        type: effect.type,
        duration: effect.duration
      });

      this.logs.push({
        type: 'status',
        text: `⚠️ [${target.name}] Status [${effect.type.toUpperCase()}]!`
      });
    }
  }

  _getUnitState(u) {
    return {
      index: u.battle_index,
      name: u.name,
      hp: u.stats.current_hp,
      max_hp: u.stats.max_hp,
      sp: u.stats.current_sp,
      max_sp: u.stats.max_sp,
      statuses: u.statuses.map(s => s.type)
    };
  }

  _checkBattleStatus() {
    const partyAlive = this.partyUnits.some(p => p.stats.current_hp > 0);
    const enemyAlive = this.enemyUnits.some(e => e.stats.current_hp > 0);

    if (!partyAlive) {
      this.isOver = true;
      this.winner = 'enemies';
    } else if (!enemyAlive) {
      this.isOver = true;
      this.winner = 'party';
    }
  }
}

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data = {}) {
    this.battleConfig = data.config || {
      party: [
        { id: 1, moveIds: ["move_tinju", "move_ranting_kayu", "move_analisis_linux"] },
        { id: 2, moveIds: ["move_tinju", "move_mandau_slash", "move_raket_smash"] },
        { id: 3, moveIds: ["move_tinju", "move_celurit_slash", "move_siraman_cabai"] }
      ],
      enemies: [
        { id: 4, moveIds: ["move_tinju", "move_provokasi_massa"] },
        { id: 5, moveIds: ["move_kick", "move_lempar_batu"] }
      ]
    };

    this.onCompleteCallback = data.onComplete || null;
    this.returnScene = data.returnScene || null;
  }

  preload() {
    this.load.spritesheet('char_spritesheet', './src/char.png', {
      frameWidth: 32,
      frameHeight: 32
    });
  }

  create() {
    this.cameras.main.setBackgroundColor('#ffffff');

    this.engine = new BattleEngine();
    this.engine.initBattle(this.battleConfig);

    this.uiState = 'TARGET_SELECT';
    this.currentPartyTurnIdx = 0;
    this.selectedTargetIdx = 0;
    this.selectedMoveIdx = 0;
    this.playerTurnActions = [];

    this.isTyping = false;
    this.currentFullText = '';
    this.typingTimer = null;

    this._createSprites();
    this._createWhiteDialog();
    this._createCursors();
    this._setupControls();

    this._startPartyInputPhase();
  }

  _createSprites() {
    this.enemySprites = [];
    this.partySprites = [];

    this.engine.enemyUnits.forEach((enemy, idx) => {
      const x = 24;
      const y = 6 + idx * 28;

      const frameIdx = Math.max(0, (enemy.spriteIndex || 1) - 1);
      const sprite = this.add.sprite(x, y, 'char_spritesheet', frameIdx);
      sprite.setDisplaySize(24, 24);

      const label = this.add.text(x - 12, y + 10, enemy.name.substring(0, 3), {
        fontFamily: 'Silkscreen',
        fontSize: '7px',
        color: '#ffcdd2'
      });

      this.enemySprites.push({ sprite, label, x, y, unit: enemy });
    });

    this.engine.partyUnits.forEach((party, idx) => {
      const x = 120;
      const y = 6 + idx * 28;

      const frameIdx = Math.max(0, (party.spriteIndex || 1) - 1);
      const sprite = this.add.sprite(x, y, 'char_spritesheet', frameIdx);
      sprite.setDisplaySize(24, 24);

      const label = this.add.text(x - 10, y + 10, party.name.substring(0, 3), {
        fontFamily: 'Silkscreen',
        fontSize: '7px',
        color: '#bbdefb'
      });

      this.partySprites.push({ sprite, label, x, y, unit: party });
    });
  }

  _createWhiteDialog() {
    const box = this.add.graphics();

    box.fillStyle(0xffffff, 1);
    box.fillRoundedRect(3, 90, 138, 67, 3);

    box.lineStyle(2, 0x000000, 1);
    box.strokeRoundedRect(2, 89, 140, 69, 4);

    box.lineStyle(1, 0xcccccc, 1);
    box.lineBetween(5, 120, 139, 120);
    box.lineBetween(70, 93, 70, 118);

    this.playerStatText = this.add.text(6, 92, '', {
      fontFamily: 'Silkscreen',
      fontSize: '8px',
      color: '#000000'
    });

    this.enemyStatText = this.add.text(73, 92, '', {
      fontFamily: 'Silkscreen',
      fontSize: '8px',
      color: '#000000'
    });

    this.dialogMsgText = this.add.text(6, 123, '', {
      fontFamily: 'Silkscreen',
      fontSize: '8px',
      color: '#000000',
      wordWrap: { width: 132 }
    });

    this.moveOptionTexts = [];

    for (let i = 0; i < 4; i++) {
      const t = this.add.text(14, 123 + i * 10, '', {
        fontFamily: 'Silkscreen',
        fontSize: '7px',
        color: '#000000'
      });

      this.moveOptionTexts.push(t);
    }
  }

  _createCursors() {
    this.targetPointer = this.add.text(0, 0, '>', {
      fontFamily: 'Silkscreen',
      fontSize: '8px',
      color: '#ffff00'
    });

    this.menuCursor = this.add.text(6, 123, '>', {
      fontFamily: 'Silkscreen',
      fontSize: '8px',
      color: '#000000'
    }).setVisible(false);
  }

  _setupControls() {
    const key = (name, fn) => this.input.keyboard.on(`keydown-${name}`, fn);

    key('UP', () => this._handleNav(-1));
    key('DOWN', () => this._handleNav(1));

    ['ENTER', 'SPACE'].forEach(k =>
      key(k, () => this._handleConfirm())
    );

    key('ESC', () => this._handleCancel());

    const emitter = this.game.events;

    if (emitter) {
      emitter.on('PAD_UP', () => this._handleNav(-1));
      emitter.on('PAD_DOWN', () => this._handleNav(1));
      emitter.on('BTN_A', () => this._handleConfirm());
      emitter.on('BTN_B', () => this._handleCancel());
    }
  }

  _updateDialogStatHUD() {
    const player = this.engine.partyUnits[this.currentPartyTurnIdx];
    const enemy = this.engine.enemyUnits[this.selectedTargetIdx];

    if (player && player.stats.current_hp > 0) {
      this.playerStatText.setText(
        `${player.name.substring(0, 6)}
HP ${player.stats.current_hp}/${player.stats.max_hp}
SP ${player.stats.current_sp}/${player.stats.max_sp}`
      );
    } else {
      this.playerStatText.setText('');
    }

    if (enemy && enemy.stats.current_hp > 0) {
      this.enemyStatText.setText(
        `${enemy.name.substring(0, 6)}
HP ${enemy.stats.current_hp}/${enemy.stats.max_hp}`
      );
    } else {
      this.enemyStatText.setText('TARGETKO');
    }
  }

  _typeText(fullText) {
    return new Promise(resolve => {
      if (this.typingTimer) this.typingTimer.remove();

      this.isTyping = true;
      this.currentFullText = fullText;
      this.dialogMsgText.setText('');
      this.dialogMsgText.setVisible(true);

      let currentLength = 0;

      this.typingTimer = this.time.addEvent({
        delay: 20,
        callback: () => {
          currentLength++;
          this.dialogMsgText.setText(fullText.substring(0, currentLength));

          if (currentLength >= fullText.length) {
            this.isTyping = false;
            this.typingTimer.remove();
            resolve();
          }
        },
        loop: true
      });

      this._resolveTyping = resolve;
    });
  }

  _skipTyping() {
    if (!this.isTyping) return false;

    if (this.typingTimer) this.typingTimer.remove();

    this.dialogMsgText.setText(this.currentFullText);
    this.isTyping = false;

    if (this._resolveTyping) this._resolveTyping();

    return true;
  }

  _startPartyInputPhase() {
    while (
      this.currentPartyTurnIdx < this.engine.partyUnits.length &&
      this.engine.partyUnits[this.currentPartyTurnIdx].stats.current_hp <= 0
    ) {
      this.currentPartyTurnIdx++;
    }

    if (this.currentPartyTurnIdx >= this.engine.partyUnits.length) {
      this._executeEngineTurn();
      return;
    }

    this.uiState = 'TARGET_SELECT';
    this.selectedTargetIdx = this._findFirstAliveEnemyIdx();

    this._renderTargetSelection();
  }

  _renderTargetSelection() {
    this.moveOptionTexts.forEach(t => t.setText(''));
    this.menuCursor.setVisible(false);

    this._updateDialogStatHUD();

    const enemySprite = this.enemySprites[this.selectedTargetIdx];

    if (enemySprite) {
      this.targetPointer.setPosition(enemySprite.x + 8, enemySprite.y - 4);
      this.targetPointer.setVisible(true);
    }

    const char = this.engine.partyUnits[this.currentPartyTurnIdx];

    this._typeText(`[${char.name}] Pilih Target Musuh!`);
  }

  _renderMoveSelection() {
    this.uiState = 'MOVE_SELECT';
    this.targetPointer.setVisible(false);

    const char = this.engine.partyUnits[this.currentPartyTurnIdx];

    this.dialogMsgText.setVisible(false);

    this.moveOptionTexts.forEach((t, idx) => {
      if (idx < char.equipped_moves.length) {
        const move = DB.getMove(char.equipped_moves[idx]);
        const moveName = move ? move.name : char.equipped_moves[idx];
        const spCost = move ? move.sp_cost : 0;

        t.setText(`${moveName.substring(0, 11)} (${spCost}SP)`);
      } else {
        t.setText('');
      }
    });

    this.selectedMoveIdx = 0;
    this.menuCursor.setVisible(true);

    this._updateMoveCursor();
  }

  _updateMoveCursor() {
    this.menuCursor.setPosition(6, 123 + this.selectedMoveIdx * 10);
  }

  _handleNav(dir) {
    if (this.uiState === 'TARGET_SELECT') {
      const enemies = this.engine.enemyUnits;
      let next = this.selectedTargetIdx;

      for (let i = 0; i < enemies.length; i++) {
        next = (next + dir + enemies.length) % enemies.length;

        if (enemies[next].stats.current_hp > 0) {
          this.selectedTargetIdx = next;
          break;
        }
      }

      if (this.enemySprites[this.selectedTargetIdx]) {
        this.targetPointer.setPosition(
          this.enemySprites[this.selectedTargetIdx].x + 8,
          this.enemySprites[this.selectedTargetIdx].y - 4
        );
      }

      this._updateDialogStatHUD();

    } else if (this.uiState === 'MOVE_SELECT') {
      const char = this.engine.partyUnits[this.currentPartyTurnIdx];
      const max = char.equipped_moves.length;

      if (max > 0) {
        this.selectedMoveIdx = (this.selectedMoveIdx + dir + max) % max;
        this._updateMoveCursor();
      }
    }
  }

  _handleConfirm() {
    if (this._skipTyping()) return;

    if (this.uiState === 'TARGET_SELECT') {
      this._renderMoveSelection();

    } else if (this.uiState === 'MOVE_SELECT') {
      const char = this.engine.partyUnits[this.currentPartyTurnIdx];

      this.playerTurnActions.push({
        actor_index: this.currentPartyTurnIdx,
        move_id: char.equipped_moves[this.selectedMoveIdx],
        target_type: 'enemy',
        target_index: this.selectedTargetIdx
      });

      this.currentPartyTurnIdx++;
      this._startPartyInputPhase();
    }
  }

  _handleCancel() {
    if (this.uiState === 'MOVE_SELECT') {
      this._renderTargetSelection();
    }
  }

  async _executeEngineTurn() {
    this.uiState = 'PROCESSING';
    this.targetPointer.setVisible(false);
    this.menuCursor.setVisible(false);
    this.moveOptionTexts.forEach(t => t.setText(''));

    const result = this.engine.processTurn(this.playerTurnActions);

    for (const logItem of result.logs) {
      const shortText = logItem.text
        .replace(/ memakai /g, '->')
        .replace(/ ke /g, ' ')
        .replace(/ (Damage: )/g, ' Dmg:');

      if (logItem.type === 'damage' && logItem.damage > 0) {
        this.cameras.main.shake(100, 0.008);
      }

      this._updateSpritesStatus();

      await this._typeText(shortText);
      await this._sleep(700);
    }

    if (result.is_over) {
      this.uiState = 'GAME_OVER';

      const isWin = result.winner === 'party';

      const outcomeText = isWin
        ? `🏆 VICTORY!
Musuh Berhasil Dikalahkan!`
        : `☠️ DEFEAT!
Tim Kamu Gugur!`;

      await this._typeText(outcomeText);
      await this._sleep(1500);

      const battleSignalPayload = {
        winner: result.winner,
        isWin,
        turnCount: result.turn
      };

      this.events.emit('battle_complete', battleSignalPayload);
      this.events.emit(isWin ? 'battle_win' : 'battle_loss', battleSignalPayload);

      if (this.game && this.game.events) {
        this.game.events.emit('BATTLE_COMPLETE', battleSignalPayload);
        this.game.events.emit(isWin ? 'BATTLE_WIN' : 'BATTLE_LOSS', battleSignalPayload);
      }

      if (typeof this.onCompleteCallback === 'function') {
        this.onCompleteCallback(battleSignalPayload);
      }

      if (this.returnScene) {
        this.scene.start(this.returnScene, battleSignalPayload);
      }

      return;
    }

    this.playerTurnActions = [];
    this.currentPartyTurnIdx = 0;

    this._startPartyInputPhase();
  }

  _updateSpritesStatus() {
    this.engine.partyUnits.forEach((p, idx) => {
      if (this.partySprites[idx]) {
        this.partySprites[idx].sprite.setAlpha(p.stats.current_hp <= 0 ? 0.3 : 1);
      }
    });

    this.engine.enemyUnits.forEach((e, idx) => {
      if (this.enemySprites[idx]) {
        this.enemySprites[idx].sprite.setAlpha(e.stats.current_hp <= 0 ? 0.2 : 1);
      }
    });
  }

  _findFirstAliveEnemyIdx() {
    return this.engine.enemyUnits.findIndex(e => e.stats.current_hp > 0);
  }

  _sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }
}
