/*
 * Copyright © 2013 VillageReach.  All Rights Reserved.  This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 *
 * If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

function DistributionController($scope, $location, deliveryZones, DeliveryZoneActivePrograms, messageService,
                                Distributions, DeliveryZoneProgramPeriods, DeliveryZoneFacilities, IndexedDB,
                                navigateBackService) {

  $scope.deliveryZones = deliveryZones;
  var DELIVERY_ZONE_LABEL = messageService.get('label.select.deliveryZone');
  var NONE_ASSIGNED_LABEL = messageService.get('label.noneAssigned');
  var DEFAULT_PROGRAM_MESSAGE = messageService.get('label.select.program');
  var DEFAULT_PERIOD_MESSAGE = messageService.get('label.select.period');

  $scope.zonePlaceholder = !!$scope.deliveryZones.length ? DELIVERY_ZONE_LABEL : NONE_ASSIGNED_LABEL;

  $scope.loadPrograms = function () {
    $scope.programs = $scope.periods = [];
    DeliveryZoneActivePrograms.get({zoneId: $scope.selectedZone.id}, function (data) {
      $scope.programs = data.deliveryZonePrograms;
      if ($scope.selectedProgram) {
        $scope.selectedProgram = _.where($scope.programs, {id: $scope.selectedProgram.id})[0];
        $scope.loadPeriods();
      }
    }, function (data) {
      $scope.error = data.data.error;
    });
  };

  $scope.loadPeriods = function () {
    $scope.periods = [];
    DeliveryZoneProgramPeriods.get({zoneId: $scope.selectedZone.id, programId: $scope.selectedProgram.id}, function (data) {
      $scope.periods = data.periods.length ? data.periods.slice(0, 13) : [];
      $scope.selectedPeriod = $scope.periods.length ? $scope.periods[0] : NONE_ASSIGNED_LABEL;
      if ($scope.selectedPeriod) {
        $scope.selectedPeriod = _.where($scope.periods, {id: $scope.selectedPeriod.id})[0];
      }
    }, function (data) {
      $scope.error = data.data.error;
    });
  };

  $scope.programOptionMessage = function () {
    return optionMessage($scope.programs, DEFAULT_PROGRAM_MESSAGE);
  };

  $scope.periodOptionMessage = function () {
    return optionMessage($scope.periods, DEFAULT_PERIOD_MESSAGE);
  };

  $scope.loadDistributionsFromCache = function () {
    var transaction = IndexedDB.getConnection().transaction('distributions');
    var cursorRequest = transaction.objectStore('distributions').openCursor();

    var aggregate = [];
    cursorRequest.onsuccess = function (event) {
      if (event.target.result) {
        aggregate.push(event.target.result.value);
        event.target.result['continue']();
      }
    };

    transaction.oncomplete = function (e) {
      $scope.distributionList = aggregate;
      $scope.$apply();
    };
  };

  $scope.$on('indexedDBReady', function () {
    $scope.loadDistributionsFromCache();
  });

  $scope.$on('$viewContentLoaded', function () {
    $scope.distributionList = navigateBackService.distributionList;
    $scope.selectedZone = navigateBackService.deliveryZone;
    $scope.selectedProgram = navigateBackService.program;
    $scope.selectedPeriod = navigateBackService.period;

    $scope.$watch('deliveryZones', function () {
      if ($scope.deliveryZones && $scope.selectedZone) {
        $scope.selectedZone = _.where($scope.deliveryZones, {id: $scope.selectedZone.id})[0];
        $scope.loadPrograms();
      }
    });
  });


  $scope.initiateDistribution = function () {
    var distribution = new Distribution($scope.selectedZone, $scope.selectedProgram, $scope.selectedPeriod);

    Distributions.save({}, distribution, onInitSuccess, {});

    function onInitSuccess(data) {
      var transaction = IndexedDB.getConnection().transaction(['distributions', 'distributionReferenceData'], 'readwrite');
      var distributionStore = transaction.objectStore('distributions');
      distributionStore.put(data.distribution);
      $scope.message = data.success;

      transaction.oncomplete = function (e) {
        $scope.loadDistributionsFromCache();
        $scope.$apply();
      };
    }
  };


  var optionMessage = function (entity, defaultMessage) {
    return entity == null || entity.length == 0 ? NONE_ASSIGNED_LABEL : defaultMessage;
  };


  $scope.viewLoadAmount = function () {
    var data = {
      deliveryZone: $scope.selectedZone,
      program: $scope.selectedProgram,
      period: $scope.selectedPeriod,
      distributionList: $scope.distributionList
    }
    navigateBackService.setData(data);
    $location.path("/view-load-amounts/" + $scope.selectedZone.id + "/" + +$scope.selectedProgram.id + "/" + $scope.selectedPeriod.id);
  }
}

DistributionController.resolve = {
  deliveryZones: function (UserDeliveryZones, $timeout, $q) {
    var deferred = $q.defer();
    $timeout(function () {
      UserDeliveryZones.get({}, function (data) {
        deferred.resolve(data.deliveryZones);
      }, {});
    }, 100);
    return deferred.promise;
  }
};
