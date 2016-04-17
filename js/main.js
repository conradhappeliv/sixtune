var pgApp = angular.module('SixTune', []);

pgApp.controller('SixTuneCtrl', function($scope) {
    $scope.inTune = false;
    $scope.tuneDiffs = [
        100,
        102,
        150,
        70,
        60,
        40
    ];
    $scope.idealFreqs = [82.407, 110, 146.83, 196, 246.94, 329.63];
    $scope.closests = [0, 0, 0, 0, 0, 0];
    $scope.closeststwo = [{val:0, good:true},{val:0, good:true},{val:0, good:true},{val:0, good:true},{val:0, good:true},{val:0, good:true}];
    setInterval(function(){
        for(var i = 0; i < $scope.closests.length; i++) {
            $scope.closeststwo[i].val = $scope.closests[i];
            $scope.closeststwo[i].good = (Math.abs($scope.closests[i]) < .35);
        }
        $scope.$apply();
    }, 100);

    navigator.getUserMedia = (navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia);

    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var analyser = audioCtx.createAnalyser();
    analyser.fftSize = 16384*2;
    analyser.smoothingTimeConstant = .8;
    var bufferLength = analyser.frequencyBinCount;
    var buffer = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(buffer);

    navigator.getUserMedia({audio: true}, function(stream) {
        var source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        source.connect(audioCtx.destination);
    }, function(){});

    var canvas = document.getElementById("myCanvas");
    var canvasCtx = canvas.getContext("2d");
    var WIDTH = 1000;
    var HEIGHT = 400;

    function draw() {
        drawVisual = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(buffer);

        // find peaks
        var peaks = [];
        var peakVals = [];
        var peakStrength = 8;
        for(var i = 0; i < bufferLength; i++) {
            if(buffer[i] <= 0) continue;
            var isAPeak = true;
            for(var j = Math.max(0, i-peakStrength); j < Math.min(bufferLength, i+peakStrength); j++) {
                if(buffer[j] > buffer[i]) {
                    isAPeak = false;
                    break;
                }
            }
            if(isAPeak) {
                peaks.push(i);
                peakVals.push(buffer[i]);
            }
        }

        // filter out "bad" local peaks
        var newPeaks = [];
        var avgPeak = 0;
        for(var i = 0; i < peaks.length; i++) avgPeak += peakVals[i];
        avgPeak /= peaks.length;
        for(var i = 0; i < peaks.length; i++) if(peakVals[i] >= avgPeak/2) newPeaks.push(peaks[i]);
        peakVals = [];
        peaks = newPeaks;
        for(peak in peaks) peakVals.push(buffer[peak]);

        // calculate each peak's freq in Hz
        var peakFreqs = [];
        for(peak in peaks) {
            var freqsToAdd = [];
            for(var i = peaks[peak]; buffer[i] >= buffer[peaks[peak]]/2; i--) {
                freqsToAdd.push({index: i, val: buffer[i]});
            }
            for(var i = peaks[peak]+1; buffer[i] >= buffer[peaks[peak]]/2; i++) {
                freqsToAdd.push({index: i, val: buffer[i]});
            }

            var sum = 0;
            for(var i = 0; i < freqsToAdd.length; i++) sum += freqsToAdd[i].val;

            var weightedAvgFreq = 0;
            for(var i = 0; i < freqsToAdd.length; i++) weightedAvgFreq += freqsToAdd[i].val/sum * freqsToAdd[i].index;

            peakFreqs.push(weightedAvgFreq*44100/analyser.fftSize);
        }




        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        var barWidth = (WIDTH / bufferLength) * 2.5;
        var barHeight;
        var x = 0;

        var closests = [];
        var closestsFreqs = [];
        for(freq in $scope.idealFreqs) {
            var ind = findClosest($scope.idealFreqs[freq], peakFreqs);
            closests.push(peaks[ind]);
            closestsFreqs.push(peakFreqs[ind] - $scope.idealFreqs[freq]);
        }
        for(var i = 0; i < $scope.closests.length; i++) {
            if(Math.abs(closestsFreqs[i]) > 5) continue;
            if(!$scope.closests[i]) $scope.closests[i] = closestsFreqs[i];
            else $scope.closests[i] = $scope.closests[i]*3/5 + closestsFreqs[i]*2/5;
        }

        for(var i = 0; i < bufferLength; i++) {
            barHeight = buffer[i]*3.125;
            if(closests.indexOf(i) >= 0) {
                canvasCtx.fillStyle = 'rgb(255,0,0)';
            }
            else {
                canvasCtx.fillStyle = 'rgb(0, 0, 0)';
            }
            canvasCtx.fillRect(x, HEIGHT-barHeight/2 ,barWidth,barHeight/2);
            barWidth = (WIDTH / bufferLength) * 2.5*14;
            x += barWidth + 1;
        }
    }

    draw();
});

function findClosest(findWhat, inWhat, bottom, top) {
    if(inWhat.length < 8) return null;
    if(typeof bottom != "number") bottom = 0;
    if(typeof top != "number") top = inWhat.length - 1;
    if(bottom >= top) return top;

    var midIndex = Math.round((top+bottom)/2);

    if(findWhat == inWhat[midIndex]) return midIndex;
    else if(inWhat[midIndex] > findWhat) {
        if(Math.abs(findWhat-inWhat[midIndex]) < Math.abs(findWhat-inWhat[midIndex-1])) return midIndex;
        return findClosest(findWhat, inWhat, bottom, midIndex-1);
    }
    else {
        if(Math.abs(findWhat-inWhat[midIndex]) < Math.abs(findWhat-inWhat[midIndex+1])) return midIndex;
        return findClosest(findWhat, inWhat, midIndex+1, top);

    }
}