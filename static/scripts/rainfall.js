rainfall = {};

rainfall.boot = function (key) {
    // Load external libraries.
    google.load('visualization', '1.0');
    google.load('maps', '3', {'other_params': 'key=' + key + '&libraries=drawing'});

    google.setOnLoadCallback(function () {
        rainfall.instance = new rainfall.App();
    });
};

rainfall.App = function () {
    this.selectionMethod = 'country';
    this.map = this.createMap();

    // Used for analysis Selection
    this.targetRegion = null;
    this.selectedCountry = null;
    this.markers = [];

    $(".results").draggable();

    //this.addCountries(countriesMapId, countriesToken);
    this.createCountries();
    this.map.data.addListener('click', this.handleMapClick.bind(this));

    $('#map-button').on('click', function (event) {
        rainfall.instance.addRainfall();
    });

    $('#graph-button').on('click', function (event) {
        rainfall.instance.addGraph();
    });

    // Register a click handler to hide the panel when the user clicks close.
    $('.results .close').click(this.hidePanel.bind(this));

    //Respond to radio button clicks (switching input style)
    $('.selection-option').on('click', this.switchStyle.bind(this));

    //Adds a marker for given input
    $('.add-marker').on('click', markers.addMarkerFromForm.bind(this))
};

/**
 * Creates a Google Map
 * The map is anchored to the DOM element with the CSS class 'map'.
 * @return {google.maps.Map} A map instance with the map type rendered.
 */
rainfall.App.prototype.createMap = function () {
    var mapOptions = {
        backgroundColor: '#000000',
        center: rainfall.App.DEFAULT_CENTER,
        //disableDefaultUI: true,
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {position: google.maps.ControlPosition.RIGHT_BOTTOM},
        zoom: rainfall.App.DEFAULT_ZOOM,
        maxZoom: rainfall.App.MAX_ZOOM
    };
    var mapEl = $('.map').get(0);
    return new google.maps.Map(mapEl, mapOptions);
};


/**
 * Retrieves the JSON data for each country
 * Loads the JSON as GeoJSON to the map's data, letting each country become a feature
 */
rainfall.App.prototype.createCountries = function () {
    this.map.data.loadGeoJson('static/polygons/countries.json');
    this.map.data.setStyle(function (feature) {
        return rainfall.App.UNSELECTED_STYLE;
    });
};

/**
 * Adds Rainfall Overlay to map using currently set Dates and targetRegion
 */
rainfall.App.prototype.addRainfall = function () {
    var startDate = $('#startDate').val();
    var endDate = $('#endDate').val();
    var button = $('#map-button');
    if (!this.checkRegion()) {
        return;
    }
    $.ajax({
        url: '/rainfall?startDate=' + startDate + '&endDate=' + endDate + '&style=' + this.selectionMethod + '&target=' + this.getTarget(),
        method: 'GET',
        beforeSend: function () {
            button.attr('value', 'Loading...');
            rainfall.instance.clearOverlays();
        },
        error: function (data) {
            button.attr('value', 'error');
            $('.results .error').show().html(data['error']);
            $('#error-message').show().html(data['error']);
        }
    }).done((function (data) {
        if (data['error']) {
            $('#error-message').show().html(data['error']);
        } else {
            button.attr('value', 'Map is being drawn...');
            var jsonObj = $.parseJSON(data);
            var mapId = jsonObj['mapid'];
            var token = jsonObj['token'];
            this.addOverlay(mapId, token);
        }
    }).bind(this));
};

/**
 * Get Graph data for targetRegion
 */
rainfall.App.prototype.addGraph = function () {
    var startDate = $('#startDate').val();
    var endDate = $('#endDate').val();
    var button = $('#graph-button');
    if (!this.checkRegion()) {
        return;
    }
    $.ajax({
        url: '/countries?startDate=' + startDate + '&endDate=' + endDate + '&style=' + this.selectionMethod + '&target=' + this.getTarget(),
        method: 'GET',
        beforeSend: function () {
            button.attr('value', 'Loading...');
        }, error: function (data) {
            button.attr('value', 'error');
            $('#error-message').show().html(data['error']);
        }
    }).done((function (data) {
        if (data['error']) {
            $('#error-message').show().html(data['error']);
        } else {
            $('.results').show();
            var title = this.selectionMethod === 'country' ? this.selectedCountry.getProperty('title') : 'Polygon';
            $('.results .title').show().text(title);
            button.attr('value', rainfall.App.GRAPH_BASE_BUTTON_NAME);
            console.log(data);
            this.showChart(data)
        }
    }).bind(this));
};

/**
 * Returns true if anything is selected
 * @returns {boolean}
 */
rainfall.App.prototype.checkRegion = function () {
    if (this.targetRegion === null) {
        $('#error-message').show().html('Select a Country or draw a Polygon first!');
        return false;
    } else {
        $('#error-message').show().html('');
    }
    return true;
};

/**
 * Handle Country Click
 * @param event
 */
rainfall.App.prototype.handleMapClick = function (event) {
    if (this.selectionMethod === 'country') {
        var feature = event.feature;
        var name = feature.getProperty('name');
        console.log('Clicked: ' + name);
        this.selectedCountry = feature;
        this.map.data.revertStyle();
        this.map.data.overrideStyle(feature, rainfall.App.SELECTED_STYLE);
        $('#selected-country').val(name);
    } else if (this.selectionMethod === 'coordinate') {
        markers.addMarkerFromClick(event);
    }
};

/**
 * Shows a chart with the given timeseries.
 * @param {Array<Array<number>>} timeseries The timeseries data
 *     to plot in the chart.
 */
rainfall.App.prototype.showChart = function (timeseries) {
    var data = google.visualization.arrayToDataTable(timeseries);

    var wrapper = new google.visualization.ChartWrapper({
        chartType: 'LineChart',
        dataTable: data,
        options: {
            title: 'Rainfall Over Time',
            //curveType: 'function',
            legend: {position: 'none'},
            titleTextStyle: {fontName: 'Roboto'}
        }
    });
    $('.results .chart').show();
    var chartEl = $('.chart').get(0);
    wrapper.setContainerId(chartEl);
    wrapper.draw();
};

/**
 * Adds overlay to the map with given mapId and token,
 * Fires event on done loading map
 * @param eeMapId
 * @param eeToken
 */
rainfall.App.prototype.addOverlay = function (eeMapId, eeToken) {
    console.log('MapID: ' + eeMapId + ', Token: ' + eeToken);
    var overlay = new google.maps.ImageMapType({
        getTileUrl: function (tile, zoom) {
            var url = rainfall.App.EE_URL + '/map/';
            url += [eeMapId, zoom, tile.x, tile.y].join('/');
            url += '?token=' + eeToken;
            return url;
        },
        tileSize: new google.maps.Size(256, 256)
    });

    this.map.overlayMapTypes.push(overlay);
};


/**
 * Removes previously added Overlay Map Types (Used to remove Map Overlay Rainfall)
 */
rainfall.App.prototype.clearOverlays = function () {
    var overlays = this.map.overlayMapTypes;
    while (overlays[0]) {
        overlays.pop().setMap(null);
    }
    this.map.overlayMapTypes.clear();
};

/**
 * Hides results panel
 */
rainfall.App.prototype.hidePanel = function () {
    $('.results').hide();
};

/**
 * Click listener for when Selection Radio-buttons are clicked
 * @param event
 */
rainfall.App.prototype.switchStyle = function (event) {
    var style = $(event.target).html();
    console.log(style);
    this.selectionMethod = style.toLowerCase();
    $('.selection-group button').html(style);
    /*
    Reset buttons
     */
    this.clearOverlays();
    $('#map-button').attr('value', rainfall.App.OVERLAY_BASE_BUTTON_NAME);
    $('#graph-button').attr('value', rainfall.App.GRAPH_BASE_BUTTON_NAME);

    /*
    Change settings
     */
    if (this.selectionMethod === 'coordinate') {
        $('.shapefile').hide();
        $('.country').hide();
        $('.markers').show();
        $('.overlay').hide();
        this.map.data.revertStyle();
        markers.draw(true);

    } else if (this.selectionMethod === 'country') {
        $('.markers').hide();
        $('.shapefile').hide();
        $('.country').show();
        $('.overlay').show();
        this.map.data.revertStyle();
        markers.draw(false);
        if (this.selectedCountry != null) {
            this.map.data.overrideStyle(this.selectedCountry, rainfall.App.SELECTED_STYLE);
        }

    } else if (this.selectionMethod === 'shapefile') {
        $('.markers').hide();
        $('.country').hide();
        $('.shapefile').show();
        $('.overlay').show();
        this.map.data.revertStyle();
        markers.draw(false);
    }
};

/**
 * Returns target, JSON encoded for polygons, regular for country names
 */
rainfall.App.prototype.getTarget = function () {
    if (this.selectionMethod === 'country') {
        return this.selectedCountry;
    } else if (this.selectionMethod === 'shapefile') {

    } else if (this.selectionMethod === 'coordinate') {
        return markers.getJSON();
    } else {
        $('#error-message').show().html('Please select a method of targeting first!');
    }
};

rainfall.App.EE_URL = 'https://earthengine.googleapis.com';

rainfall.App.SELECTED_STYLE = {strokeWeight: 4};
rainfall.App.UNSELECTED_STYLE = {
    fillOpacity: 0.0,
    strokeColor: 'black',
    strokeWeight: 1
};

rainfall.App.OVERLAY_BASE_BUTTON_NAME = 'Create Overlay';

rainfall.App.GRAPH_BASE_BUTTON_NAME = 'Create Graph';

rainfall.App.DEFAULT_CENTER = {lng: 0.0, lat: 12.5};
rainfall.App.DEFAULT_ZOOM = 3;
rainfall.App.MAX_ZOOM = 14;

rainfall.App.CHIRPS_CLIMATE = 'UCSB-CHG/CHIRPS/DAILY';
rainfall.App.TERA_EVAPOTRANSPIRATION = 'MODIS/006/MOD16A2';

