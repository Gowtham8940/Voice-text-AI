class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sampleCount = 0;
    this.buffer = new Int16Array(4096);
    this.bufferIndex = 0;
    this.frameCount = 0;
  }

  process(inputs, outputs) {
    this.frameCount++;
    const input = inputs[0];
    
    // Send debug info every 100 frames
    if (this.frameCount % 100 === 0) {
      this.port.postMessage({
        type: 'debug',
        inputLength: input.length,
        channelCount: input.length > 0 ? input[0].length : 0,
        frameCount: this.frameCount
      });
    }
    
    if (input && input.length > 0 && input[0].length > 0) {
      const channelData = input[0];
      
      // Convert Float32 to Int16 PCM
      for (let i = 0; i < channelData.length; i++) {
        const sample = channelData[i];
        this.buffer[this.bufferIndex] = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        this.bufferIndex++;
        
        // Send when buffer is full
        if (this.bufferIndex >= this.buffer.length) {
          const pcmCopy = new Int16Array(this.buffer);
          this.sampleCount += pcmCopy.length;
          this.port.postMessage({
            type: 'audio',
            pcm: pcmCopy,
            samples: this.sampleCount
          });
          this.bufferIndex = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
