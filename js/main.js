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
});

navigator.getUserMedia = (navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia);

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var analyser = audioCtx.createAnalyser();
analyser.fftsize = 2048;
var buffer = new Uint8Array(analyser.fftsize);
analyser.getByteTimeDomainData(buffer);

navigator.getUserMedia({audio: true}, function(stream) {
    var source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
}, function(){});

var canvas = document.getElementById("myCanvas");
var canvasCtx = canvas.getContext("2d");

function draw() {
    drawVisual = requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(buffer);

    canvasCtx.fillStyle = 'rgb(200, 200, 200)';
    canvasCtx.fillRect(0, 0, 200, 100);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    var sliceWidth = 200 * 1.0 / analyser.fftsize;
    var x = 0;

    for(var i = 0; i < analyser.fftsize; i++) {

        var v = buffer[i] / 128.0;
        var y = v * 100/2;

        if(i === 0) {
            canvasCtx.moveTo(x, y);
        } else {
            canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();
}

draw();