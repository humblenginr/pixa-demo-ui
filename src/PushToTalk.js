import React, { useState, useRef, useEffect } from 'react';
import { Circle, Loader, WifiOff } from 'lucide-react';
import {AudioQueueManager} from "./speak.js"
import {resampleAudio, decodePCM16FromBase64, floatTo16BitPCM, base64EncodeAudio} from "./utils.js"

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const WebsocketURL = `${wsProtocol}://localhost:8080/ws`;

function PushToTalk() {
  const [isConnected, setIsConnected] = useState(false);
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptDone, setTranscriptDone] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState("Idle");
  const [messageQueue, setMessageQueue] = useState([]);
  // Refs
  const audioContextRef = useRef(null);
  const websocketRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);


  // Establish WebSocket connection and start listening
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
           // have to play this audio
           setText("Playing...");
           audioQueueManager.addAudioToQueue(decodePCM16FromBase64(message.data))
        } else if (message.type === 'response.audio.done'){
            setText("Idle")
        } else if(message.type === 'input_audio_buffer.cleared'){
        } else if (message.type === 'input_audio_buffer.speech_started'){
            setText("Listening...")
        } else if (message.type === 'response.audio_transcript.delta'){
            console.log('Delta received:', message.data)
            setMessageQueue(prev => [...prev, message]);
        } else if (message.type === 'response.audio_transcript.done'){
          console.log("done")
          setMessageQueue(prev => [...prev, message]);
        } else if (message.type === 'input_audio_buffer.speech_stopped'){
          setText("Processing...");
        }else {
          console.error("Unhandled message type received from server: ", message.type)
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


useEffect(() => {
  if (messageQueue.length === 0) return;
  
  const message = messageQueue[0];
  
  if (message.type === 'response.audio_transcript.delta') {
    setTranscriptText(prevText => {
      if (transcriptDone) {
        console.log('First delta after done, resetting with:', message.data);
        setTranscriptDone(false);
        return message.data;
      } else {
        console.log('Appending delta to:', prevText);
        return prevText + message.data;
      }
    });
  } else if (message.type === 'response.audio_transcript.done') {
    setTranscriptDone(true);
  }
  
  // Remove the processed message
  setMessageQueue(prev => prev.slice(1));
}, [messageQueue, transcriptDone]);
  
async function startListening() {
    try {
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
        // proceed only when isSendingAudio is true
        const audioData = event.inputBuffer.getChannelData(0);
        // first resmaple data and then encode as base64 and send to the server directly
        // because ChatGPT realtime only supports PCM16 audio format at 24kHz sample rate
        // const base64AudioData = base64EncodeAudio(resampleAudio(audioData, sampleRate, 24000))
        const base64AudioData = base64EncodeAudio(audioData)
        if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
              websocketRef.current.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                data: base64AudioData
              }));
          }

      };
      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (error) {
      console.error(error);
    }
  }

  
    const getCircleClassName = () => {
    const baseClasses = "w-48 h-48 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out relative";
    
    if (!isConnected) {
      return `${baseClasses} bg-gray-300 border-4 border-red-500`; // Added red border for disconnected state
    }
    
    switch (text) {
      case 'Listening...':
        return `${baseClasses} bg-black animate-pulse`;
      case 'Processing...':
        return `${baseClasses} bg-orange-500`;
      default:
        return `${baseClasses} bg-black`;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-2xl px-4">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className={getCircleClassName()}>
              {text === 'Listening...' && (
                <div className="absolute w-full h-full rounded-full animate-ping bg-black opacity-50" />
              )}
              {!isConnected ? (
                <WifiOff className="text-red-500" size={64} /> // Changed to WifiOff icon with red color
              ) : text === 'Processing...' ? (
                <Loader className="text-gray-100 animate-spin" size={64} />
              ) : (
                <Circle className="text-gray-100" size={64} />
              )}
            </div>
          </div>
          
          <div className="mt-6 w-full text-center">
            <h2 className={`text-xl font-semibold mb-2 ${!isConnected ? 'text-red-500' : ''}`}>
              {!isConnected ? 'Connection Lost' : text}
            </h2>
            <div className="mt-2 text-lg break-words">
              {transcriptText}
            </div>
            
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
