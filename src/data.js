window.POLISODIUM_DATA = {
  player: {
    name: 'MC', hp: 100, maxHp: 100,
    items: ['GARAM', 'SENTER', 'DUPA', 'CERMIN'],
    sprite: { path: '/char.png', frameWidth: 16, frameHeight: 16, moveDuration: 160, stepSize: 16 },
    directions: {
      up: { dx: 0, dy: -1, idleFrame: 8 },
      down: { dx: 0, dy: 1, idleFrame: 0 },
      left: { dx: -1, dy: 0, idleFrame: 4 },
      right: { dx: 1, dy: 0, idleFrame: 7 }
    },
    animations: { down: [1, 2], left: [4, 5], right: [7, 6], up: [9, 10] }
  },
  ghosts: [
    { id: 1, name: 'KUYANG', frame: 0, hp: 40, maxHp: 40, atk: 8, weakness: 'SENTER', isBoss: false },
    { id: 2, name: 'POCONG', frame: 1, hp: 50, maxHp: 50, atk: 10, weakness: 'GARAM', isBoss: false },
    { id: 3, name: 'HANTU BANYU', frame: 2, hp: 60, maxHp: 60, atk: 12, weakness: 'DUPA', isBoss: false },
    { id: 4, name: 'HANTU KELAMBU', frame: 3, hp: 55, maxHp: 55, atk: 11, weakness: 'CERMIN', isBoss: false },
    { id: 5, name: 'ANAK SIMA', frame: 4, hp: 70, maxHp: 70, atk: 15, weakness: 'GARAM', isBoss: false },
    { id: 6, name: 'MARIABAN', frame: 5, hp: 120, maxHp: 120, atk: 20, weakness: 'DUPA', isBoss: true }
  ],
  episodes: {
    2: { map: '/map/map1.png', spawn: [25, 45], fight: [54, 240], radius: 25, enemyId: 1 },
    3: { map: '/map/map2.png', spawn: [98, 18], fight: [206, 72], radius: 23, enemyId: 2 },
    4: { map: '/map/map3.png', spawn: [121, 230], fight: [126, 91], radius: 42, enemyId: 3 },
    5: { map: '/map/map4.png', spawn: [124, 18], fight: [127, 181], radius: 40, enemyId: 4 },
    6: { map: '/map/map5.png', spawn: [38, 110], fight: [200, 111], radius: 25, enemyId: 5 },
    7: { map: '/map/map6.png', spawn: [116, 242], fight: [130, 23], radius: 25, enemyId: 6 }
  }
};

