// MPEG audio frames, just enough to cut an MP3 into a quick first part (see theme.ts).

const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];

/**
 * The whole frames that hold the first `seconds` of an MPEG-1 Layer III file without tags:
 * their size in bytes and their duration. Decoded on their own, those bytes give exactly the
 * first samples of the whole file (a frame only refers back to the frames before it), in a
 * fraction of the time. Null when the file is shorter or of another kind.
 */
export function mp3Head(bytes: Uint8Array, seconds: number): { size: number; seconds: number } | null {
  let size = 0;
  let time = 0;
  while (time < seconds) {
    if (size + 4 > bytes.length) return null;
    const [a, b, c] = [bytes[size], bytes[size + 1], bytes[size + 2]];
    // Frame sync, MPEG-1, Layer III (with or without CRC).
    if (a !== 0xff || (b & 0xfe) !== 0xfa) return null;
    const kbps = KBPS[c >> 4];
    const rate = RATES[(c >> 2) & 3];
    if (!kbps || !rate) return null;
    size += Math.floor((144000 * kbps) / rate) + ((c >> 1) & 1);
    time += 1152 / rate;
  }
  return size <= bytes.length ? { size, seconds: time } : null;
}
