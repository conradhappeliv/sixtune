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