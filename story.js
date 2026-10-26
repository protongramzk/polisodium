// story.js
import State from './state.js';

// Helper pemanggil battle
export const startBattle = (scene, ghostId, onWin, onLose) => {
  State.save('posX', scene.pixelX);
  State.save('posY', scene.pixelY);

  scene.scene.start('BattleScene', {
    ghostId: ghostId,
    player: { hp: State.get('hp'), maxHp: State.get('maxHp') },
    onWin: (log) => {
      State.save('hp', log.playerHp);
      if (onWin) onWin(log);
    },
    onLose: (log) => {
      State.save('hp', State.get('maxHp')); // Heal penuh kalau kalah
      if (onLose) onLose(log);
    }
  });
};

export const STORY_SEQUENCE = {
  1: {
    NovelID: 1,
    MapSource: null,
    ArrayEvent: [],
    nextSeq: 2
  },
  2: {
    NovelID: 2,
    MapSource: '/map/map1.png',
    SpawnPx: [25, 45],
    ArrayEvent: [
      {
        coord: [54, 240], radius: 25, btn: 'A',
        event: (scene) => {
          startBattle(scene, 1, 
            (log) => {
              State.save('currentSeq', 3);
              window.game.scene.start('BootScene'); // FIX: Pakai global instance
            },
            (log) => {
              alert("Dihisap Kuyang! Coba lagi.");
              window.game.scene.start('BootScene');
            }
          );
        }
      }
    ]
  },
  3: {
    NovelID: 3, 
    MapSource: '/map/map2.png',
    SpawnPx: [98, 18],
    ArrayEvent: [
      {
        coord: [206, 72], radius: 23, btn: 'A',
        event: (scene) => {
          startBattle(scene, 2, 
            (log) => {
              State.save('currentSeq', 4);
              window.game.scene.start('BootScene');
            },
            (log) => {
              alert("Diseruduk Pocong! Coba lagi.");
              window.game.scene.start('BootScene');
            }
          );
        }
      }
    ]
  },
  4: {
    NovelID: 4, 
    MapSource: '/map/map3.png',
    SpawnPx: [121, 230],
    ArrayEvent: [
      {
        coord: [126, 91], radius: 42, btn: 'A',
        event: (scene) => {
          startBattle(scene, 3, 
            (log) => {
              State.save('currentSeq', 5);
              window.game.scene.start('BootScene');
            },
            (log) => {
              alert("Tenggelam ditarik Hantu Banyu! Coba lagi.");
              window.game.scene.start('BootScene');
            }
          );
        }
      }
    ]
  },
  5: {
    NovelID: 5, 
    MapSource: '/map/map4.png',
    SpawnPx: [124, 18],
    ArrayEvent: [
      {
        coord: [127, 181], radius: 40, btn: 'A',
        event: (scene) => {
          startBattle(scene, 4, 
            (log) => {
              State.save('currentSeq', 6);
              window.game.scene.start('BootScene');
            },
            (log) => {
              alert("Dibungkus Hantu Kelambu! Coba lagi.");
              window.game.scene.start('BootScene');
            }
          );
        }
      }
    ]
  },
  6: {
    NovelID: 6, 
    MapSource: '/map/map5.png',
    SpawnPx: [38, 110],
    ArrayEvent: [
      {
        coord: [200, 111], radius: 25, btn: 'A',
        event: (scene) => {
          startBattle(scene, 5, 
            (log) => {
              State.save('currentSeq', 7);
              window.game.scene.start('BootScene');
            },
            (log) => {
              alert("Kena tipu Anak Sima! Coba lagi.");
              window.game.scene.start('BootScene');
            }
          );
        }
      }
    ]
  },
  7: {
    NovelID: 7, 
    MapSource: '/map/map6.png',
    SpawnPx: [116, 242],
    ArrayEvent: [
      {
        coord: [130, 23], radius: 25, btn: 'A',
        event: (scene) => {
          startBattle(scene, 6, 
            (log) => {
              State.save('currentSeq', 8);
              window.game.scene.start('BootScene');
            },
            (log) => {
              alert("Dihabisi Mariaban! Coba lagi bro.");
              window.game.scene.start('BootScene');
            }
          );
        }
      }
    ]
  },
  8: {
    NovelID: 8,
    MapSource: null,
    ArrayEvent: [],
    nextSeq: null
  }
};

