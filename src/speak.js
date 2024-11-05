export class AudioQueueManager {
    audioQueue = [];
    isPlaying = false;
    pitchFactor = 1; 

    constructor() {}

    // Function to set the pitch factor
    setPitchFactor(factor) {
        this.pitchFactor = factor;
    }

    // Function to add audio data to the queue
    addAudioToQueue(audioData) {
        this.audioQueue.push(audioData);
        this.playNext()
    }

    // Function to play the next audio chunk in the queue
    async playNext() {
        if (this.isPlaying || this.audioQueue.length === 0) return;

        this.isPlaying = true;

        const audioData = this.audioQueue.shift(); // Get the next audio chunk
        await this.playAudio(audioData); // Play the audio

        this.isPlaying = false;
        this.playNext(); // Play the next audio in the queue
    }

    // Function to play a single audio chunk with pitch adjustment
    playAudio(audioBuffer) {
        return new Promise((resolve) => {
            // Create an AudioContext
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Convert Int16Array (PCM16) to Float32Array
            const float32Array = new Float32Array(audioBuffer.length);
            for (let i = 0; i < audioBuffer.length; i++) {
                float32Array[i] = audioBuffer[i] / 0x7FFF; // Normalize to -1.0 to 1.0
            }

            // Create an AudioBuffer
            const audioBufferObj = audioContext.createBuffer(1, float32Array.length, audioContext.sampleRate);
            audioBufferObj.copyToChannel(float32Array, 0); // Copy PCM data to the buffer

            // Create a BufferSource to play the audio
            const source = audioContext.createBufferSource();
            source.buffer = audioBufferObj;
            source.playbackRate.value = this.pitchFactor; // Adjust pitch if necessary
            source.connect(audioContext.destination);

            source.onended = () => {
                resolve(); // Resolve when the playback ends
            };

            source.start(0); // Start playback
        });
    }
}


