var pgApp = angular.module('SixTune', ['ngAnimate']);

pgApp.controller('SixTuneCtrl', function($scope) {
    // Constants
    var numberToAverage = 20; // number of buffers to average over
    var fftsize = 16384; // power of 2 from 32 to 32768 - big performance hit, but higher = more accurate
    var smoothing = .4; // 0 to 1, 1 is "smoother"
    var peakCutoff = 4/7; // At what amplitude below the peaks should the frequencies not be averaged in
    var refreshTime = 40; // ms
    // Frequency graph parameters
    var canvasWidth = 1000;
    var canvasHeight = 400;

    $scope.showData = false;
    $scope.idealFreqs = [82.407, 110, 146.83, 196, 246.94, 329.63]; // pitches to tune to
    $scope.closests = [0, 0, 0, 0, 0, 0];
    $scope.diffTimeData = [];
    $scope.closeststwo = [{val:0, good:true},{val:0, good:true},{val:0, good:true},{val:0, good:true},{val:0, good:true},{val:0, good:true}];
    $scope.closeststwotest = [0, 0, 0, 0, 0, 0];
    $scope.stringclasses = ['onnote', 'onnote', 'onnote', 'onnote', 'onnote', 'onnote'];

    // UI update
    setInterval(function(){
        // use an average of the previous data sets to calculate the current one
        var curData = [];
        for(var i = 0; i < $scope.closests.length; i++) {
            curData.push({val: $scope.closests[i], good: (Math.abs($scope.closests[i]) < .5)});
        }
        $scope.diffTimeData.push(curData);
        if($scope.diffTimeData.length > numberToAverage) $scope.diffTimeData.shift();


        for(var stringNum = 0; stringNum < $scope.closeststwo.length; stringNum++) {
            var avgVal = 0;
            var goodNum = 0;
            for(var i = 0; i < $scope.diffTimeData.length; i++) {
                avgVal += $scope.diffTimeData[i][stringNum].val;
                if($scope.diffTimeData[i][stringNum].good) goodNum++;
            }
            avgVal /= $scope.diffTimeData.length;

            $scope.closeststwo[stringNum].val = avgVal;
            $scope.closeststwo[stringNum].good = goodNum > Math.floor($scope.diffTimeData.length/2);
        }
        $scope.updatecolors();
        $scope.$apply();
    }, refreshTime);

    $scope.updatecolors = function () {
      for (var i = 0; i < $scope.stringclasses.length; i++) {
        if ($scope.closeststwo[i].good) {
          $scope.stringclasses[i] = 'onnote';
        } else if ($scope.closeststwo[i].val < 0) {
          $scope.stringclasses[i] = 'undernote';
        } else {
          $scope.stringclasses[i] = 'overnote';
        }
      }
    };

    $scope.testcolors = function() {
        $scope.showData = !$scope.showData;
    };

    navigator.getUserMedia = (navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia);

    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var analyser = audioCtx.createAnalyser();
    analyser.fftSize = fftsize;
    analyser.smoothingTimeConstant = smoothing;
    var bufferLength = analyser.frequencyBinCount;
    var buffer = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(buffer);

    navigator.getUserMedia({audio: true}, function(stream) {
        window.source = audioCtx.createMediaStreamSource(stream);
        window.source.connect(analyser);
    }, function(){});

    var canvas = document.getElementById("myCanvas");
    var canvasCtx = canvas.getContext("2d");

    // TODO: this method makes computers try to lift off?? Is is the drawing or the computation or?
    function draw() {
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
            for(var i = peaks[peak]; buffer[i] >= buffer[peaks[peak]]*peakCutoff; i--) {
                freqsToAdd.push({index: i, val: buffer[i]});
            }
            for(var i = peaks[peak]+1; buffer[i] >= buffer[peaks[peak]]*peakCutoff; i++) {
                freqsToAdd.push({index: i, val: buffer[i]});
            }

            var sum = 0;
            for(var i = 0; i < freqsToAdd.length; i++) sum += freqsToAdd[i].val;

            var weightedAvgFreq = 0;
            for(var i = 0; i < freqsToAdd.length; i++) weightedAvgFreq += freqsToAdd[i].val/sum * freqsToAdd[i].index;

            peakFreqs.push(weightedAvgFreq*44100/analyser.fftSize);
        }




        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);

        var barWidth = (canvasWidth / bufferLength) * 2.5;
        var barHeight;
        var x = 0;

        var closests = [];
        var closestsFreqs = [];
        for(var freq = 0; freq < $scope.idealFreqs.length; freq++) {
            var ind = findClosest($scope.idealFreqs[freq], peakFreqs);
            closests.push(peaks[ind]);
            closestsFreqs.push(peakFreqs[ind] - $scope.idealFreqs[freq]);
        }
        for(var i = 0; i < $scope.closests.length; i++) {
            if(Math.abs(closestsFreqs[i]) > 5) continue;
            if(!$scope.closests[i]) $scope.closests[i] = closestsFreqs[i];
            else $scope.closests[i] = $scope.closests[i]*3/5 + closestsFreqs[i]*2/5;
        }

        // TODO: figure out what the magic 53 number comes from
        for(var i = 0; i < bufferLength/53; i++) {
            barHeight = buffer[i]*3.125;
            if(closests.indexOf(i) >= 0) {
                canvasCtx.fillStyle = 'rgb(255,0,0)';
            }
            else {
                canvasCtx.fillStyle = 'rgb(0, 0, 0)';
            }
            canvasCtx.fillRect(x, canvasHeight-barHeight/2, barWidth, barHeight/2);
            barWidth = (canvasWidth / bufferLength) * 2.5*18;
            x += barWidth + 1;
        }
        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
});

/*
Modified binary search that finds the index of the closest (or equal) value to findWhat in the inWhat array
bottom and top parameters used for recursion (can be omitted)
 */
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
