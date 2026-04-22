/**
 * Audio processing utilities for Gemini 3.1 Flash Live API.
 * Requirements: 16-bit Little Endian PCM, 16kHz Mono.
 */

export class AudioProcessor {
  /**
   * Converts Float32 audio buffer to 16-bit PCM (Int16Array).
   */
  static toPCM16(buffer: Float32Array): Int16Array {
    const pcm = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      // Clamp between -1.0 and 1.0
      const s = Math.max(-1, Math.min(1, buffer[i]));
      // Convert to 16-bit range
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm;
  }

  /**
   * Resamples audio to 16kHz if necessary.
   */
  static async resample(audioBuffer: AudioBuffer, targetRate: number = 16000): Promise<Float32Array> {
    const offlineCtx = new OfflineAudioContext(
      1,
      (audioBuffer.duration * targetRate),
      targetRate
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer.getChannelData(0);
  }

  /**
   * Base64 encoding for PCM data.
   */
  static arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
