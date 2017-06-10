/*=============== self-executing function BEGINING ===============*/
(function() {
"use strict";

/*=============== WaypointCalculator Constructor BEGINING ===============*/
function WaypointCalculator(options) {
	this._elem = options.elem;
	if (!this._elem) return;

	this._summaryTextPanel = options.summaryTextPanel;
	this._startWaypointElem = options.startWaypointElem;
	this._endWaypointElem = options.endWaypointElem;
	this._stopWaypointsContainer = options.stopWaypointsContainer;
	this._stopWaypointsElemsArr = this._stopWaypointsContainer.querySelectorAll('.stop_waypoint');
	this._messages = options.messages;
	this._resultWin = options.resultWin;
	this._bounds = options.bounds;
	this._countryCode = options.countryCode;

	this._select = this._elem.querySelector('.cars_select');

	if (gMapLoaded) {
		this._init();
	} else {
		document.addEventListener('gmaploaded', function() {
//            console.log('caught gmaploaded event');
			this._init();
		}.bind(this));
	}
}

WaypointCalculator.prototype._init = function() {
	this._geocoder = new google.maps.Geocoder();

	this._directionsService = new google.maps.DirectionsService;
//    this._directionsDisplay = new google.maps.DirectionsRenderer;
//    this._map = new google.maps.Map(document.getElementById('map'), {
//        zoom: 6,
//        center: {lat: 41.85, lng: -87.65}
//    });
//    this._directionsDisplay.setMap(this._map);

	this._errorNotif = this._elem.querySelector('.error_notif');
	this._initAutocomplete();
	this._initButtons();

	this._elem.querySelector('#submit').addEventListener('click', function() {
		this._calculateAndDisplayRoute();
	}.bind(this));
};

WaypointCalculator.prototype._initButtons = function() {
	this._addWaypointBtn = this._elem.querySelector('#add_waypoint');

	this._addWaypointBtn.addEventListener('click', this._addWaypoint.bind(this));
}

WaypointCalculator.prototype._addWaypoint = function() {
	if (this._hiddenStopWaypoints.length > 0) {

		var waypoinToShow = this._hiddenStopWaypoints[0];
		waypoinToShow.show();
	}
};

WaypointCalculator.prototype._initAutocomplete = function() {
	// Create the autocomplete object, restricting the search to geographical
	// location types.
	var arr = [],
		waypoint;

	var gMapBounds = this._createBounds();

	if (this._startWaypointElem) {
		this._startWaypoint = new WayPoint({
			elem: this._startWaypointElem,
			defaultBounds: gMapBounds,
			geocoder: this._geocoder,
			countryCode: this._countryCode,
			notAccurateAddressMessage: this._messages.wrongAddress,
			messages: this._messages
		});
	}

	if (this._endWaypointElem) {
		this._endWaypoint = new WayPoint({
			elem: this._endWaypointElem,
			defaultBounds: gMapBounds,
			geocoder: this._geocoder,
			countryCode: this._countryCode,
			notAccurateAddressMessage: this._messages.wrongAddress,
			messages: this._messages
		});
	}

	this._stopWaypointsArr = [];
	this._shownStopWaypoints = [];
	this._hiddenStopWaypoints = [];

	for (var i = 0; i < this._stopWaypointsElemsArr.length; i++) {
		waypoint = new WayPoint({
			elem: this._stopWaypointsElemsArr[i],
			defaultBounds: gMapBounds,
			geocoder: this._geocoder,
			countryCode: this._countryCode,
			notAccurateAddressMessage: this._messages.wrongAddress,
			messages: this._messages,
			hidden: true
		});

		this._hiddenStopWaypoints.push(waypoint);
		this._stopWaypointsArr.push(waypoint);
	}

	this._elem.addEventListener('waypointShown', this._onWaypointShown.bind(this));
	this._elem.addEventListener('waypointHidden', this._onWaypointHidden.bind(this));
};

WaypointCalculator.prototype._createBounds = function() {
	if (typeof this._bounds !== 'object') {
		this._bounds = {};
	}
	if (!'sw' in this._bounds) {
		this._bounds.sw = [-90, -180];
	}
	if (!'ne' in this._bounds) {
		this._bounds.ne = [90, 180];
	}

	return new google.maps.LatLngBounds(
		new google.maps.LatLng(this._bounds.sw[0], this._bounds.sw[1]),
		new google.maps.LatLng(this._bounds.ne[0], this._bounds.ne[1])
	);
};

WaypointCalculator.prototype._onWaypointShown = function(e) {
	var waypoint = e.detail;
	if (!waypoint) return;

	var index = this._hiddenStopWaypoints.indexOf(waypoint);

	if (index > -1) {
		this._hiddenStopWaypoints.splice(index, 1);
	}

	if (this._hiddenStopWaypoints.length === 0) {
		this._addWaypointBtn.style.display = 'none';
	}

	this._shownStopWaypoints.push(waypoint);
};

WaypointCalculator.prototype._onWaypointHidden = function(e) {
	var waypoint = e.detail;
	if (!waypoint) return;

	var index = this._shownStopWaypoints.indexOf(waypoint);

	if (index > -1) {
		this._shownStopWaypoints.splice(index, 1);
	}

	this._addWaypointBtn.style.display = '';

	this._hiddenStopWaypoints.push(waypoint);
};

WaypointCalculator.prototype._calculateAndDisplayRoute = function() {
	var waypts = [],
		selectVal = this._select.value,
		startVal = this._startWaypoint.getValue(),
		endVal = this._endWaypoint.getValue(),
		tranVal,
		validate = true;

	for (var i = 0; i < this._shownStopWaypoints.length; i++) {
		tranVal = this._shownStopWaypoints[i].getValue();
		if (tranVal) {
			waypts.push({
				location: tranVal,
				stopover: true
			});
		} else {
			validate = false;
		}
	}

	if (!startVal || !endVal || !validate) {
//        console.log('You must fill in all fields before submitting!');
		this._errorNotif.style.display = 'block';
		this._errorNotif.innerHTML = this._messages.emptyFields;
		return;
	}

	this._errorNotif.style.display = '';
	this._errorNotif.innerHTML = '';

	this._directionsService.route({
			origin: startVal,
			destination: endVal,
			waypoints: waypts,
			optimizeWaypoints: false,
			travelMode: google.maps.TravelMode.DRIVING
		}, function(response, status) {
			var distance = 0;
			if (status === google.maps.DirectionsStatus.OK) {
				var route = response.routes[0];
				var routesHtml = '';
				// For each route, display summary information.
				for (var i = 0, routeSegmentNum = 1; i < route.legs.length; i++) {
					routesHtml += this._messages.routeSegmentTitle.replace('{{routeSegmentNum}}', routeSegmentNum) + '<br>';
					routesHtml += route.legs[i].start_address + ' to ';
					routesHtml += route.legs[i].end_address + '<br>';
					routesHtml += route.legs[i].distance.text + '<br><br>';

					distance += route.legs[i].distance.value;
					routeSegmentNum++;
				}

				if (this._summaryTextPanel && 'innerHTML' in this._summaryTextPanel) {
					this._summaryTextPanel.innerHTML = routesHtml;
				}

				this._showResultWindow(distance);

			} else {
				alert(this._messages.directionRequestFail.replace('{{status}}', status));

			}
		}.bind(this)
	);
};

WaypointCalculator.prototype._showResultWindow = function(totalPrice) {
	if (!this._resultWin) {
		alert(this._messages.totalPriceResultWindowNotFound.replace('{{totalPrice}}', totalPrice));
		return;
	}

	this._resultWin.innerHTML = '<div>' + this._messages.totalPrice.replace('{{totalPrice}}', totalPrice) + '</div>' +
		'<button>Back</button>';
	this._resultWin.style.display = 'block';

	var button = this._resultWin.querySelector('button');
	var self = this;
	button.addEventListener('click', function hideResult(){
		button.removeEventListener('click', hideResult);
		self._resultWin.innerHTML = '';
		self._resultWin.style.display = '';
	});
};
/*=============== WaypointCalculator Constructor END ===============*/

/*=============== WayPoint Constructor BEGINING ===============*/
function WayPoint(options) {
	this._elem = options.elem;
	this._defaultBounds = options.defaultBounds;
	this._countryCode = options.countryCode;
	this._messages = options.messages;
	this._value = null;
	this._geocoder = options.geocoder;

	this._init();

	if (options.hidden) {
		this._hide();
	}
}

WayPoint.prototype._init = function() {
	this._input = this._elem.querySelector('.waypoint_input');
	this._infoWin = this._elem.querySelector('.info_win');

	if (!this._input) return;

	this._autocomplete = new google.maps.places.Autocomplete(
		/** @type {!HTMLInputElement} */(this._input),
		{
			types: ['address'],
			bounds: this._defaultBounds,
			componentRestrictions: this._getComponentRestrictions()
		}
	);

	this._initCloseBtn();

	this._infoWin.addEventListener('click', this._onInfoWinClick.bind(this));
	this._autocomplete.addListener('place_changed', this._fillInAddress.bind(this));
	this._input.addEventListener('blur', this._onBlur.bind(this));
};

WayPoint.prototype._getComponentRestrictions = function() {
//	var componentRestrictions = false;
//	if (this._countryCode) {
//		componentRestrictions = {
//			country: this._countryCode
//		}
//	}
//
//	return componentRestrictions;
	return this._countryCode ? { country: this._countryCode } : false;
};


WayPoint.prototype._initCloseBtn = function() {
	this._closeBtn = this._elem.querySelector('.close_btn');

	if (this._closeBtn) {
		this._closeBtn.addEventListener('click', this._hide.bind(this))
	}
};

WayPoint.prototype.show = function() {
	this._container.appendChild(this._elem);

	var customEvent = new CustomEvent('waypointShown', {
		bubbles: true,
		detail: this
	});

	this._elem.dispatchEvent(customEvent);
};

WayPoint.prototype._hide = function() {
	this._infoWin.innerHTML = '';
	this._infoWin.style.display = '';
	this._input.value = '';

	this._container = this._elem.parentElement;

	var customEvent = new CustomEvent('waypointHidden', {
		bubbles: true,
		detail: this
	});

	this._elem.dispatchEvent(customEvent);

	this._container.removeChild(this._elem);
};

WayPoint.prototype._onBlur = function(e) {
	var self = this;

	function onAutocompletePalceChanged() {
		self._elem.removeEventListener('autocompletePlaceChanged', onAutocompletePalceChanged);
		if (self._timeout) {
			clearTimeout(self._timeout);
			delete self._timeout;
		}
	}

	this._timeout = setTimeout(function(){
		onAutocompletePalceChanged();
		var value = this._input.value.trim();
		if (value) {
		   this._geocodeAddress(value);
		}
	}.bind(this), 500);

	this._elem.addEventListener('autocompletePlaceChanged', onAutocompletePalceChanged);
};

WayPoint.prototype._fillInAddress = function() {
	// Get the place details from the autocomplete object.
	var customEvent = new CustomEvent('autocompletePlaceChanged', {
		bubbles: true
	});

	this._elem.dispatchEvent(customEvent);

	var place = this._autocomplete.getPlace();

	if (!place.address_components) {
		this._geocodeAddress(place.name);

	} else {
		if (this._validateFormattedAddress(place)) {
			this._value = place.formatted_address;
			this._infoWin.style.display = '';
			this._infoWin.innerHTML = this._messages.validatedAddress.replace('{{address}}', place.formatted_address);
		} else {
			this._value = null;
			this._infoWin.style.display = 'block';
			this._infoWin.innerHTML = this._messages.wrongAddress;
		}

	}
};

WayPoint.prototype._geocodeAddress = function(address) {
	this._geocoder.geocode({
		address: address,
		bounds: this._defaultBounds,
		componentRestrictions: this._getComponentRestrictions()
	}, function(results, status) {
		if (status === google.maps.GeocoderStatus.OK) {
			if (results.length === 1) {

				if (this._validateFormattedAddress(results[0])) {
					this._value = results[0].formatted_address;
					this._infoWin.style.display = '';
					this._infoWin.innerHTML = this._messages.validatedAddress.replace('{{address}}', results[0].formatted_address);
				} else {
					this._value = null;
					this._infoWin.style.display = 'block';
					this._infoWin.innerHTML = this._messages.wrongAddress;
				}

			} else {
				this._value = null;
				this._showVariants(results);
			}

		} else {
			this._value = null;
			this._infoWin.style.display = 'block';
			this._infoWin.innerHTML = this._messages.noResults;
		}
	}.bind(this));
};

WayPoint.prototype._showVariants = function(results) {
	var variantsListHTML = '<ul class="variants_list">';

	for (var i = 0, k = 0; i < results.length; i++) {
		if (this._validateFormattedAddress(results[i])) {
			k++;
			variantsListHTML += '<li><a class="possible_variant">' + results[i].formatted_address + '</a></li>';
		}
	}

	variantsListHTML += '</ul>';

	this._infoWin.style.display = 'block';
	if (!k) {
		this._infoWin.innerHTML = this._messages.wrongAddress;

	} else {
		this._infoWin.innerHTML = '<div>' + this._messages.variantsTitle + '</div>' + variantsListHTML;

	}
};

WayPoint.prototype._onInfoWinClick = function(e) {
	var target = e.target;
	if (!target) return;

	if (target.matches('.possible_variant')) {
		this._input.value = target.textContent;
		this._onBlur(null, this._input);
	}
}

WayPoint.prototype._validateFormattedAddress = function(geoData, checkRegex) {
	var valid = false;
	if (checkRegex == undefined) {
		checkRegex = false;
	}

	var streetNumberRegex = /^L?O?T? ?[0-9]+/;

	if (geoData.address_components) {
		for (var i = 0; i < geoData.address_components.length; i++) {
			// if street number or an airport
			if (geoData.address_components[i].types.indexOf('street_number') > -1 ||
				geoData.name !== undefined && geoData.name.toLowerCase().indexOf('airport') >= 0) {
					valid = true;
			}
		}
	}

	if (checkRegex) {
		if (streetNumberRegex.test(geoData.formatted_address)) {
			// regex for street number
			valid = true;
		}
	}

	// Not valid yet, check to see if it is a point of interest
	// If not more than one address component, we cannot get directions
	if (! valid && geoData.address_components && geoData.address_components.length > 1 && geoData.types) {
		 var allowedPointsOfInterest = [
			'airport',
			'amusement_park',
			'aquarium',
			'art_gallery',
			'bar',
			'beauty_salon',
			'bicycle_store',
			'book_store',
			'bowling_alley',
			'bus_station',
			'cafe',
			'campground',
			'car_dealer',
			'car_rental',
			'car_repair',
			'car_wash',
			'casino',
			'cemetery',
			'church',
			'city_hall',
			'clothing_store',
			'convenience_store',
			'courthouse',
			'dentist',
			'department_store',
			'doctor',
			'electrician',
			'electronics_store',
			'embassy',
			'establishment',
			'fire_station',
			'florist',
			'funeral_home',
			'furniture_store',
			'gas_station',
			'grocery_or_supermarket',
			'gym',
			'hair_care',
			'hardware_store',
			'hindu_temple',
			'home_goods_store',
			'hospital',
			'jewelry_store',
			'laundry',
			'library',
			'liquor_store',
			'local_government_office',
			'lodging',
			'mosque',
			'movie_theater',
			'museum',
			'night_club',
			'parkparking',
			'pet_store',
			'pharmacy',
			'place_of_worship',
			'post_office',
			'premise',
			'restaurant',
			'rv_park',
			'school',
			'shopping_mall',
			'spa',
			'stadium',
			'subway_station',
			'synagogue',
			'taxi_stand',
			'train_station',
			'university',
			'veterinary_care',
			'zoo'
		];

		geoData.types.some(function(key, val) {
			if (allowedPointsOfInterest.indexOf(key) > -1) {
				valid = true;
				return false;
			}
		});
	}

	return valid;
};

WayPoint.prototype.getValue = function() {
	return this._value;
};
/*=============== WayPoint Constructor END ===============*/

/*=============== WaypointCalculator Initialisation BEGINING ===============*/
document.addEventListener('DOMContentLoaded', function() {
	var calculatorElem = document.getElementById('waypoint_calculator');

	if (calculatorElem) {
		var waypointCalculator = new WaypointCalculator({
			elem: calculatorElem,
//			summaryTextPanel: calculatorElem.querySelector('#directions-panel'),
			startWaypointElem: calculatorElem.querySelector('#start'),
			endWaypointElem: calculatorElem.querySelector('#end'),
			stopWaypointsContainer: calculatorElem.querySelector('.stop_waypoints'),
			resultWin: calculatorElem.querySelector('.result'),
			messages: {
				wrongAddress: 'Need more accurate address!',
				emptyFields: 'You must fill in all fields before submitting!',
				variantsTitle: 'Maybe you mean:',
				noResults: 'No results were found!',
				validatedAddress: 'Validated address:<br>{{address}}',
				totalPrice: 'Estimated price is ${{totalPrice}}',
				totalPriceResultWindowNotFound: 'Result window was not found!<br>Estimated price ${{totalPrice}}',
				directionRequestFail: 'Directions request failed due to {{status}}',
				routeSegmentTitle: '<b>Route Segment: {{routeSegmentNum}}</b>'
			},
			bounds: {
				sw: [-34.204216, 150.416944],
				ne: [-33.440977, 151.555402]
			},
			countryCode: 'au'
		});
	}
});
/*=============== WaypointCalculator Initialisation END ===============*/

})();
/*=============== self-executing function END ===============*/
