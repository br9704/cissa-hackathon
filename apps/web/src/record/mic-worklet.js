/*
  Runs on the audio thread.

  Copies mono input into fixed 2048 sample frames and posts them to the main thread with a
  transfer, so nothing is copied twice and nothing is allocated per render quantum beyond
  the one slice that leaves.

  This is an AudioWorklet rather than a MediaRecorder on purpose. MediaRecorder with a
  timeslice hands back WebM blobs where only the FIRST one carries the container header,
  so blobs two onwards cannot be decoded independently, and every naive implementation
  ends up either re-prepending headers or accumulating the whole recording and decoding it
  again. A worklet gives raw PCM with none of that.
*/
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Float32Array(2048);
    this.n = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.frame[this.n++] = channel[i];
      if (this.n === this.frame.length) {
        const out = this.frame.slice();
        this.port.postMessage(out, [out.buffer]);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor("capture", CaptureProcessor);
