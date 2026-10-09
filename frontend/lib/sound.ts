// Som do aviso de aprovação, sintetizado no navegador (sem arquivo): a batida grave do carimbo e dois tons claros.
let ctx: AudioContext | null = null;

// Navegadores só liberam áudio depois de um gesto da pessoa: o primeiro clique ou tecla destrava.
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null; // sem Web Audio: o aviso só fica visual
  }
}

// delay em segundos: casa a batida com o carimbo da animação.
export function playApprovalSound(delay = 0.43) {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + delay;

  const thump = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thump.frequency.setValueAtTime(150, t);
  thump.frequency.exponentialRampToValueAtTime(52, t + 0.13);
  thumpGain.gain.setValueAtTime(0.0001, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.55, t + 0.006);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  thump.connect(thumpGain).connect(ctx.destination);
  thump.start(t);
  thump.stop(t + 0.22);

  // Mi6 e Lá6: sobe uma quarta, soa como "ok".
  for (const [freq, offset] of [[1318.5, 0.14], [1760, 0.27]]) {
    const tone = ctx.createOscillator();
    const gain = ctx.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(freq, t + offset);
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.16, t + offset + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.65);
    tone.connect(gain).connect(ctx.destination);
    tone.start(t + offset);
    tone.stop(t + offset + 0.7);
  }
}
