import React, { useState, useRef, useEffect } from 'react';
import { Circle, Loader, WifiOff } from 'lucide-react';
import {AudioQueueManager} from "./speak.js"
import {resampleAudio, decodePCM16, floatTo16BitPCM, base64EncodeAudio} from "./utils.js"

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
//const WebsocketURL = `${wsProtocol}://localhost:80/`;
const WebsocketURL = `${wsProtocol}://13.203.86.242:8080/`;


function PushToTalk() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  // Refs
  const audioContextRef = useRef(null);
  const websocketRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  const audioQueueManagerRef = useRef(null);



  // Establish WebSocket connection and start listening
  useEffect(() => {
    // Create WebSocket connection
    websocketRef.current = new WebSocket(WebsocketURL);
    websocketRef.current.binaryType = "arraybuffer"

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
    audioQueueManagerRef.current = audioQueueManager
    websocketRef.current.onmessage = async (event) => {
      try {
        if (event.data instanceof ArrayBuffer) {
          // pcm16 audio data to be played
          audioQueueManager.addAudioToQueue(resampleAudio(decodePCM16(event.data), audioContextRef.current.sampleRate, 24000))
        } else {
          console.log("Received text data: ", event.data);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        setError(`Error processing audio: ${error.message}`);
      }
    };


    startListening();
    // Cleanup on component unmount
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    };
  }, []);


async function startListening() {
    try {
      // Start capturing audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
        },
      });
      audioContextRef.current = new AudioContext();
      const sampleRate = audioContextRef.current.sampleRate
      console.log({sampleRate})
      audioQueueManagerRef.current.setPitchFactor(24000.0/sampleRate)

      mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      const source = mediaStreamSourceRef.current
      const audioContext = audioContextRef.current

      processor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
          websocketRef.current.send(floatTo16BitPCM(resampleAudio(audioData, sampleRate, 24000)))
          }
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (error) {
      console.error(error);
    }
  }

  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-2xl px-4">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="circle">
              {isConnected && (
                <div className="absolute w-full h-full rounded-full animate-ping bg-black opacity-50" />
              )}
              {!isConnected ? (
                <WifiOff className="text-red-500" size={64} /> // Changed to WifiOff icon with red color
              ) : (
                <Circle className="text-gray-100" size={64} />
              )}
            </div>
          </div>
          
          <div className="mt-6 w-full text-center">
            <h2 className={`text-xl font-semibold mb-2 ${!isConnected ? 'text-red-500' : ''}`}>
              {!isConnected ? 'Connection Lost' : ""}
            </h2>
            
            {error && (
              <div className="mt-4 p-2 bg-red-100 text-red-800 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}export default PushToTalk;
