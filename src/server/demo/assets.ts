import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { Mp3Encoder } from '@breezystack/lamejs';
import { zipSync } from 'fflate';

export const sampleRate = 22050;
export interface DemoSound { master: Float32Array; kick: Float32Array; percussion: Float32Array; melody: Float32Array }

export function makeSound(bpm: number, seed: number, seconds = 12): DemoSound {
  const length = sampleRate * seconds;
  const master = new Float32Array(length);
  const kick = new Float32Array(length);
  const percussion = new Float32Array(length);
  const melody = new Float32Array(length);
  const beat = 60 / bpm;
  let noise = seed + 1;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const phase = t % beat;
    const half = t % (beat / 2);
    noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
    const random = noise / 0xffffffff * 2 - 1;
    const envelope = Math.min(1, t / 0.02, (seconds - t) / 0.08);
    kick[i] = Math.sin(2 * Math.PI * (45 * phase + 9 * (1 - Math.exp(-12 * phase)))) * Math.exp(-13 * phase) * 0.58 * envelope;
    const snare = Math.floor(t / beat) % 4 === 1 || Math.floor(t / beat) % 4 === 3;
    percussion[i] = random * (0.10 * Math.exp(-90 * half) + (snare ? 0.22 * Math.exp(-22 * phase) : 0)) * envelope;
    const notes = [0, 3, 7, 10];
    const rootOffset = [0, 3, 5, 0, 7][seed % 5]!;
    const frequency = 110 * 2 ** ((notes[Math.floor(t / beat) % notes.length]! + rootOffset) / 12);
    melody[i] = (Math.sin(2 * Math.PI * frequency * t) + 0.3 * Math.sin(2 * Math.PI * frequency * 2 * t)) * 0.12 * Math.exp(-phase * 3) * envelope;
    master[i] = Math.max(-0.95, Math.min(0.95, kick[i]! + percussion[i]! + melody[i]!));
  }
  return { master, kick, percussion, melody };
}

export function wav(samples: Float32Array): Buffer {
  const result = Buffer.alloc(44 + samples.length * 2);
  result.write('RIFF'); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16); result.writeUInt16LE(1, 20); result.writeUInt16LE(1, 22);
  result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * 2, 28);
  result.writeUInt16LE(2, 32); result.writeUInt16LE(16, 34); result.write('data', 36);
  result.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) result.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), 44 + i * 2);
  return result;
}

export function mp3(samples: Float32Array): Buffer {
  const encoder = new Mp3Encoder(1, sampleRate, 96);
  const pcm = Int16Array.from(samples, (value) => Math.round(Math.max(-1, Math.min(1, value)) * 32767));
  const blocks: Buffer[] = [];
  for (let offset = 0; offset < pcm.length; offset += 1152) {
    blocks.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(offset, offset + 1152))));
  }
  blocks.push(Buffer.from(encoder.flush()));
  return Buffer.concat(blocks);
}

export function zip(files: Record<string, Uint8Array>): Buffer {
  return Buffer.from(zipSync(files, { level: 6, mtime: new Date('2020-01-01T00:00:00Z') }));
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Buffer): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(name: string, data: Buffer): Buffer {
  const type = Buffer.from(name);
  const size = Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, crc]);
}
export function cover(seed: number): Buffer {
  const palettes = [[164, 114, 242], [245, 146, 78], [92, 184, 196], [165, 215, 88], [231, 111, 145]];
  const color = palettes[seed % palettes.length]!;
  const size = 640;
  const pixels = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const distance = Math.hypot(x - size * 0.50, y - size * 0.46);
    const ring = Math.abs(Math.sin(distance / (14 + seed * 2)));
    const grid = x % 32 === 0 || y % 32 === 0;
    const stripe = Math.sin(x / 29 + y / 37 + seed) > 0.86;
    const light = 0.13 + (1 - y / size) * 0.18 + (ring > 0.91 ? 0.46 : 0) + (grid ? 0.08 : 0) + (stripe ? 0.08 : 0);
    const position = y * (size * 3 + 1) + 1 + x * 3;
    for (let channel = 0; channel < 3; channel++) pixels[position + channel] = Math.min(255, Math.round(color[channel]! * light + 10));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

export function stableId(name: string): string {
  const value = createHash('sha1').update('beatstore-demo-v1:' + name).digest().subarray(0, 16);
  value[6] = (value[6]! & 15) | 0x50; value[8] = (value[8]! & 63) | 0x80;
  const text = value.toString('hex');
  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`;
}
