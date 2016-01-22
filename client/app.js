$(function() {
  
  var host = location.origin.replace(/^http/, 'ws') + '/binary-endpoint';
  
  var client = new BinaryClient(host);

  var soundController = {};
  soundController.recording = false;

  var audioContext = window.AudioContext || window.webkitAudioContext;

  navigator.mediaDevices = navigator.mediaDevices ||
    ((navigator.mozGetUserMedia || navigator.webkitGetUserMedia) ? {
      getUserMedia: function(c) {
        return new Promise(function(y, n) {
          (navigator.mozGetUserMedia ||
            navigator.webkitGetUserMedia).call(navigator, c, y, n);
        });
      }
    } : null);

  navigator.mediaDevices.getUserMedia = function(c) {
    return new Promise(function(y, n) {
      (navigator.mozGetUserMedia ||
        navigator.webkitGetUserMedia).call(navigator, c, y, n);
    });
  }

  if (!navigator.mediaDevices) {
    console.log("getUserMedia() not supported.");
  }

  soundController.device = navigator.mediaDevices.getUserMedia({
    audio: true,
    video: false
  });

  soundController.device.then(function(stream) {
    var context = new audioContext();
    var audioInput = context.createMediaStreamSource(stream);
    var bufferSize = 2048;
    // create a javascript node
    soundController.recorder = context.createScriptProcessor(bufferSize, 1, 1);
    // specify the processing function
    soundController.recorder.onaudioprocess = soundController.recorderProcess;
    // connect stream to our recorder
    audioInput.connect(soundController.recorder);
    // connect our recorder to the previous destination
    soundController.recorder.connect(context.destination);
  });

  soundController.device.catch(function(err) {
    console.log("The following error occured: " + err.name);
  });

  function convertFloat32ToInt16(buffer) {
    l = buffer.length;
    buf = new Int16Array(l);
    while (l--) {
      buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
    }
    return buf.buffer;
  }

  soundController.recorderProcess = function(e) {
    var left = e.inputBuffer.getChannelData(0);
    if (soundController.recording === true) {
      // var chunk = convertFloat32ToInt16(left);
      var chunk = left;
      console.dir(chunk);
      soundController.stream.write(chunk);
    }
  };

  soundController.startRecording = function() {

    if (soundController.recording === false) {
      console.log('>>> Start Recording');

      //open binary stream
      soundController.stream = client.createStream({
        data: 'audio'
      });
      soundController.recording = true;
    }

  };

  soundController.stopRecording = function() {

    if (soundController.recording === true) {
      console.log('||| Stop Recording');

      soundController.recording = false;

      //close binary stream
      soundController.stream.end();
    }
  };

  $("#start-rec-btn").click(function() {
    soundController.startRecording();
  });


  $("#stop-rec-btn").click(function() {
    soundController.stopRecording();
  });

  // var soundController = {};

  soundController.speakerContext = new audioContext();

  client.on('stream', function(stream) {
    soundController.nextTime = 0;
    var init = false;
    var audioCache = [];

    console.log('>>> Receiving Audio Stream');

    stream.on('data', function(data) {
      var array = new Float32Array(data);
      var buffer = soundController.speakerContext.createBuffer(1, 2048, 44100);
      buffer.copyToChannel(array, 0);

      audioCache.push(buffer);
      // make sure we put at least 5 chunks in the buffer before starting
      if ((init === true) || ((init === false) && (audioCache.length > 5))) {
        init = true;
        soundController.playCache(audioCache);
      }
    });

    stream.on('end', function() {
      console.log('||| End of Audio Stream');
    });

  });

  soundController.playCache = function(cache) {
    while (cache.length) {
      var buffer = cache.shift();
      var source = soundController.speakerContext.createBufferSource();
      source.buffer = buffer;
      source.connect(soundController.speakerContext.destination);
      if (soundController.nextTime == 0) {
        // add a delay of 0.05 seconds
        soundController.nextTime = soundController.speakerContext.currentTime + 0.05;
      }
      source.start(soundController.nextTime);
      // schedule buffers to be played consecutively
      soundController.nextTime += source.buffer.duration;
    }
  };
});
