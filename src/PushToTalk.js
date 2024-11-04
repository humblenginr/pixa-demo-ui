import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import {AudioQueueManager} from "./speak.js"

const WebsocketURL = "ws://localhost:8080/ws"

function PushToTalk() {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const audioContextRef = useRef(null);
  const websocketRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const audioDataRef = useRef([]);

  const outputAudioDataRef = useRef(``);

  function decodePCM16FromBase64(base64String) {
    const binaryString = atob(base64String);
    const buffer = new ArrayBuffer(binaryString.length);
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Int16Array(buffer);
}

  // Establish WebSocket connection
  useEffect(() => {
    // Create WebSocket connection
    websocketRef.current = new WebSocket(WebsocketURL);

    websocketRef.current.onopen = () => {
      console.log('WebSocket connection established');
      setIsConnected(true);
    };

    websocketRef.current.onclose = () => {
      console.log('WebSocket connection closed');
      setIsConnected(false);
    };

    websocketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    const audioQueueManager = new AudioQueueManager();
    websocketRef.current.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'response.audio.delta' && message.data) {
           audioQueueManager.addAudioToQueue(decodePCM16FromBase64(message.data))
        } else if (message.type === 'response.audio.done'){
        }

      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        setError(`Error processing audio: ${error.message}`);
      }
    };

    // Cleanup on component unmount
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);


function floatTo16BitPCM(float32Array) {
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
  const base64EncodeAudio = (float32Array) => {
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

function resampleAudio(inputData, inputSampleRate, targetSampleRate) {
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

async function startListening() {
    try {
        audioDataRef.current = []
        // Start capturing audio
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
            },
        });
        audioContextRef.current = new AudioContext();
        const sampleRate = audioContextRef.current.sampleRate
        mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        const source = mediaStreamSourceRef.current
        const audioContext = audioContextRef.current

        processor.onaudioprocess = (event) => {
            const audioData = event.inputBuffer.getChannelData(0);
            // because ChatGPT realtime only supports PCM16 audio format at 24kHz sample rate
            audioDataRef.current.push(resampleAudio(audioData, sampleRate, 24000));
            // audioDataRef.current.push(audioData);
        };
        source.connect(processor);
        processor.connect(audioContext.destination);
        setIsRecording(true);
    } catch (error) {
        console.error(error);
        setIsRecording(false);
    }
}

const stopListening = () => {
    if (!isRecording) return;

    // Disconnect and stop
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    console.log({adu: audioDataRef.current})
    const combinedAudioData = new Float32Array(audioDataRef.current.reduce((tot, arr) => tot + arr.length, 0))

    // Combine all audio chunks
    let offset = 0;
    for (const chunk of audioDataRef.current) {
      combinedAudioData.set(chunk, offset);
      offset += chunk.length;
    }

    console.log({combinedAudioData})
    // Base64 encode
    const base64AudioData = base64EncodeAudio(combinedAudioData);

    // Send to WebSocket if connected
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        type: 'audio',
        data: base64AudioData
      }));
    }

    // Reset state
    setIsRecording(false);
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <div 
          className={`
            w-48 h-48 rounded-full flex items-center justify-center cursor-pointer 
            transition-all duration-300 ease-in-out shadow-lg
            ${!isConnected 
              ? 'bg-gray-500 cursor-not-allowed' 
              : isRecording 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-blue-500 hover:bg-blue-600'
            }
          `}
          onMouseDown={isConnected ? startListening : undefined}
          onMouseUp={isConnected ? stopListening : undefined}
          onMouseLeave={isConnected ? stopListening : undefined}
        >
          {!isConnected ? (
            <MicOff color="white" size={64} />
          ) : isRecording ? (
            <MicOff color="white" size={64} />
          ) : (
            <Mic color="white" size={64} />
          )}
        </div>
        
        <div className="mt-6 text-center">
          <h2 className="text-xl font-semibold mb-2">
            {!isConnected 
              ? 'Connecting...' 
              : isRecording 
                ? 'Recording...' 
                : 'Push to Talk'
            }
          </h2>
          
          {error && (
            <div className="mt-4 p-2 bg-red-100 text-red-800 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PushToTalk;
