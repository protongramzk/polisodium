const canvas = document.querySelector('#screen');
const ctx = canvas.getContext('2d', {
  alpha: false
});

const video = document.querySelector('#intro');

const WIDTH = 144;
const HEIGHT = 160;

const START = 21;
const END = 26;
const FPS = 30;
const FRAME = 1 / FPS;

let mode = 'FORWARD';
let reverseTimer = 0;
let lastFrame = 0;

// Matikan smoothing
ctx.imageSmoothingEnabled = false;

// Render video ke resolusi 144x160
function render() {
  ctx.drawImage(video, 0, 0, WIDTH, HEIGHT);
}

// Mulai rewind
function startReverse() {
  mode = 'REVERSE';
  video.pause();
  reverseTimer = 0;
}

// Rewind frame demi frame
async function reverseFrame() {
  if (mode !== 'REVERSE') return;

  video.currentTime = Math.max(
    START,
    video.currentTime - FRAME
  );

  await new Promise(resolve => {
    video.addEventListener('seeked', resolve, { once: true });
  });

  render();

  if (video.currentTime <= START + 0.001) {
    video.currentTime = START;
    mode = 'FORWARD';
    await video.play();
    return;
  }

  requestAnimationFrame(reverseFrame);
}

// Pantau video
function update(timestamp) {
  render();

  if (
    mode === 'FORWARD' &&
    video.currentTime >= END
  ) {
    startReverse();
    requestAnimationFrame(reverseFrame);
  }

  requestAnimationFrame(update);
}

// Mulai intro
async function start() {
  try {
    await video.play();
    requestAnimationFrame(update);
  } catch (error) {
    console.warn('Autoplay membutuhkan interaksi pengguna:', error);

    document.addEventListener('click', async () => {
      await video.play();
      requestAnimationFrame(update);
    }, { once: true });
  }
}

video.addEventListener('loadeddata', start, { once: true });
