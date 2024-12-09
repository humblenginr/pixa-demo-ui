// Convert float32 audio data to 16-bit PCM binary
export function floatTo16BitPCM(inputData) {
  // Create a new ArrayBuffer to hold 16-bit PCM data
  const buffer = new ArrayBuffer(inputData.length * 2); // 2 bytes per sample
  const view = new DataView(buffer);

  for (let i = 0; i < inputData.length; i++) {
    // Convert float to 16-bit integer
    // Clamp the value between -1 and 1, then scale to 16-bit range
    const sample = Math.max(-1, Math.min(1, inputData[i]));
    const int16 = Math.round(sample < 0 
      ? sample * 0x8000 
      : sample * 0x7FFF);
    
    // Write the 16-bit sample at the correct position (2 bytes per sample)
    view.setInt16(i * 2, int16, true); // true for little-endian
  }

  return buffer;
}  // Base64 encode PCM16 data
export const base64EncodeAudio = (float32Array) => {
    const arrayBuffer = floatTo16BitPCM(float32Array);
    let binary = '';
    let bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000; // 32KB chunk size
    for (let i = 0; i < bytes.length; i += chunkSize) {
      let chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

export function resampleAudio(inputData, inputSampleRate, targetSampleRate) {
    const ratio = targetSampleRate / inputSampleRate;
    const outputLength = Math.floor(inputData.length * ratio);
    const output = new Float32Array(outputLength);
    
    for (let i = 0; i < outputLength; i++) {
      const position = i / ratio;
      const index = Math.floor(position);
      const decimal = position - index;
      
      const a = inputData[index] || 0;
      const b = inputData[Math.min(index + 1, inputData.length - 1)] || 0;
      output[i] = a + (b - a) * decimal;
    }
    
    return output;
  }


export function decodePCM16(buffer) {
    return new Int16Array(buffer);
  }
