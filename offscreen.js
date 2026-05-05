const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();

osc.connect(gain);
gain.connect(ctx.destination);

osc.type = 'sine';
osc.frequency.value = 880;
gain.gain.setValueAtTime(0.5, ctx.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);

osc.onended = () => {
  chrome.runtime.sendMessage({ action: 'offscreen-done' });
};

ctx.resume().then(() => {
  osc.start();
  osc.stop(ctx.currentTime + 2);
});
