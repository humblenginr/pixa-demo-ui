export function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  // Base64 encode PCM16 data
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

export function decodePCM16FromBase64(base64String) {
    const binaryString = atob(base64String);
    const buffer = new ArrayBuffer(binaryString.length);
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Int16Array(buffer);
  }
