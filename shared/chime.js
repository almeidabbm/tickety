// The built-in call chime: two soft notes, accent on the first, the second rings longer. Used by the display and the admin preview.
function playChime(audio) {
  const now = audio.currentTime;
  [[659.25, 0, 0.35, 0.9], [523.25, 0.32, 1.4, 0.6]].forEach(([freq, start, length, gain]) => {
    const osc = audio.createOscillator();
    const env = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, now + start);
    env.gain.linearRampToValueAtTime(0.25 * gain, now + start + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
    osc.connect(env).connect(audio.destination);
    osc.start(now + start);
    osc.stop(now + start + length + 0.05);
  });
}
