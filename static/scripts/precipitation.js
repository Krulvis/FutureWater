precipitation = {};

precipitation.boot = function (key) {
    // Load external libraries.
    google.load('visualization', '1.0');
    google.load('maps', '3', {'other_params': 'key=' + key + '&libraries=drawing'});

    google.setOnLoadCallback(function () {
        precipitation.instance = new precipitation.App();
        precipitation.instance.initVals();
    });
};

precipitation.App = function () {
    this.map = this.createMap();

    //Some styling
    $('.results').draggable();
    $.getJSON('static/polygons/countries2.json', function (json) {
        var names = [];
        json.features.forEach(function (feature) {
            names.push(feature.properties.Country);
        });
        $("#selected-country").autocomplete({
            source: names,
            select: precipitation.instance.handleCountryUIClick
        });
    });

    //this.addCountries(countriesMapId, countriesToken);
    this.createCountries();
    this.map.data.addListener('click', this.handleMapClick.bind(this));

    // Register a click handler to hide the panel when the user clicks close.
    $('.results .close').click(this.hidePanel.bind(this));

    //Respond to radio button clicks (switching input style)
    $('.style-container .nav-item').on('click', this.switchStyle.bind(this));

    //Adds a marker for given input
    $('.add-marker').on('click', markers.addMarkerFromForm.bind(this));

    //Add functionality to buttons
    $('#overlay-button').on('click', function (event) {
        precipitation.instance.getOverlay();
    });

    $('#graph-button').on('click', function (event) {
        precipitation.instance.getGraph();
    });
};

/**
 * Set the initial Values to use
 */
precipitation.App.prototype.initVals = function () {
    this.targetRegion = null;
    this.selectedCountry = null;
    this.markers = [];
    this.selectionMethod = 'country';
    products.resetRadios();
};

/**
 * Creates a Google Map
 * The map is anchored to the DOM element with the CSS class 'map'.
 * @return {google.maps.Map} A map instance with the map type rendered.
 */
precipitation.App.prototype.createMap = function () {
    var mapOptions = {
        backgroundColor: '#000000',
        center: precipitation.App.DEFAULT_CENTER,
        //disableDefaultUI: true,
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {position: google.maps.ControlPosition.RIGHT_BOTTOM},
        zoom: precipitation.App.DEFAULT_ZOOM,
        maxZoom: precipitation.App.MAX_ZOOM
    };
    var mapEl = $('.map').get(0);
    return new google.maps.Map(mapEl, mapOptions);
};


/**
 * Retrieves the JSON data for each country
 * Loads the JSON as GeoJSON to the map's data, letting each country become a feature
 */
precipitation.App.prototype.createCountries = function () {
    this.map.data.loadGeoJson('static/polygons/countries2.json');
    this.map.data.setStyle(function (feature) {
        return precipitation.App.UNSELECTED_STYLE;
    });
};

/**
 * Adds Rainfall Overlay to map using currently set Dates and targetRegion
 */
precipitation.App.prototype.getOverlay = function () {
    var startDate = $('#startDate').val();
    var endDate = $('#endDate').val();
    var button = $('#overlay-button');
    if (!this.checkRegion()) {
        return;
    }
    $.ajax({
        url: '/overlay?startDate=' + startDate + '&endDate=' + endDate + '&style=' + this.selectionMethod + '&product=' + this.getProduct() + '&target=' + this.getTarget(),
        method: 'GET',
        beforeSend: function () {
            button.attr('value', 'Loading...');
            precipitation.instance.clearOverlays();
        },
        error: function (data) {
            button.html('error');
            $('#error-message').show().html('Error obtaining data!');
        }
    }).done((function (data) {
        if (data['error']) {
            $('#error-message').show().html('Error: ' + data['error']);
        } else {
            button.html('Map is being drawn...');
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
precipitation.App.prototype.getGraph = function () {
    var startDate = $('#startDate').val();
    var endDate = $('#endDate').val();
    var button = $('#graph-button');
    if (!this.checkRegion()) {
        return;
    }
    $.ajax({
        url: '/graph?startDate=' + startDate + '&endDate=' + endDate + '&style=' + this.selectionMethod + '&product=' + this.getProduct() + '&target=' + this.getTarget(),
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
            button.attr('value', precipitation.App.GRAPH_BASE_BUTTON_NAME);
            console.log(data);
            this.showChart(data)
        }
    }).bind(this));
};

/**
 * Returns true if anything is selected
 * @returns {boolean}
 */
precipitation.App.prototype.checkRegion = function () {
    var error = $('#error-message');
    error.show().html('');
    switch (this.selectionMethod) {
        case 'country':
            if (this.selectedCountry === null) {
                error.show().html('Select a Country first!');
                return false;
            }
            break;
        case 'coordinate':

            return true;

        case 'shapefile':
            break;
    }
    return true;
};

/**
 * Handle Map Click (Places marker, Selects Country)
 * @param event
 */
precipitation.App.prototype.handleMapClick = function (event) {
    if (this.selectionMethod === 'coordinate') {
        markers.addMarkerFromClick(event);
    }
    /* disable fucking broken feature click
        else if (this.selectionMethod === 'country') {
            var feature = event.feature;
            var name = feature.getProperty('Country');
            console.log('Clicked: ' + name);
            this.selectedCountry = feature;
            this.map.data.revertStyle();
            this.map.data.overrideStyle(feature, precipitation.App.SELECTED_STYLE);
            $('#selected-country').val(name);
        } */
};

/**
 * Handles click on UI, marks and sets clicked country name
 * @param event
 * @param ui
 */
precipitation.App.prototype.handleCountryUIClick = function (event, ui) {
    var countryName = ui.item.label;
    console.log('Clicked: ' + countryName);
    precipitation.instance.map.data.forEach(function (feature) {
        if (feature.getProperty('Country') === countryName) {
            precipitation.instance.map.data.revertStyle();
            precipitation.instance.selectedCountry = feature;
            precipitation.instance.map.data.overrideStyle(precipitation.instance.selectedCountry, precipitation.App.SELECTED_STYLE);
            return;
        }
    })
};

/**
 * Shows a chart with the given timeseries.
 * @param {Array<Array<number>>} timeseries The timeseries data
 *     to plot in the chart.
 */
precipitation.App.prototype.showChart = function (timeseries) {
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
precipitation.App.prototype.addOverlay = function (eeMapId, eeToken) {
    console.log('MapID: ' + eeMapId + ', Token: ' + eeToken);
    var overlay = new google.maps.ImageMapType({
        getTileUrl: function (tile, zoom) {
            var url = precipitation.App.EE_URL + '/map/';
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
precipitation.App.prototype.clearOverlays = function () {
    var overlays = this.map.overlayMapTypes;
    while (overlays[0]) {
        overlays.pop().setMap(null);
    }
    this.map.overlayMapTypes.clear();
};

/**
 * Hides results panel
 */
precipitation.App.prototype.hidePanel = function () {
    $('.results').hide();
};

/**
 * Click listener for when Selection Radio-buttons are clicked
 * @param event
 */
precipitation.App.prototype.switchStyle = function (event) {
    var html = $(event.target).html();
    var style = html.substr(html.indexOf('</i>') + 4);
    console.log(style);
    this.selectionMethod = style.toLowerCase();
    $('.selection-group button').html(style);
    $('#error-message').hide();

    /*
    Reset buttons
     */
    this.clearOverlays();
    $('#overlay-button').attr('value', precipitation.App.OVERLAY_BASE_BUTTON_NAME);
    $('#graph-button').attr('value', precipitation.App.GRAPH_BASE_BUTTON_NAME);

    var overlayTab = $('#overlay-tab');
    var graphTab = $('#graph-tab');
    /*
    Change settings
     */
    switch (this.selectionMethod) {
        case 'coordinate':
            overlayTab.addClass('disabled');
            graphTab.tab('show');//Force going to graph
            this.map.data.revertStyle();
            markers.draw(true);
            break;
        case 'country':
            overlayTab.removeClass('disabled');
            this.map.data.revertStyle();
            markers.draw(false);
            if (this.selectedCountry != null) {
                this.map.data.overrideStyle(this.selectedCountry, precipitation.App.SELECTED_STYLE);
            }
            break;
        case 'shapefile':
            overlayTab.removeClass('disabled');
            this.map.data.revertStyle();
            markers.draw(false);
            break;
    }
    products.resetRadios();
};

/**
 * Returns the selected Analysing Method
 * @returns {jQuery}
 */
precipitation.App.prototype.getProduct = function () {
    return $('#overlay input:radio:checked').attr('id');
};

/**
 * Returns target, JSON encoded for polygons, regular for country names
 */
precipitation.App.prototype.getTarget = function () {
    switch (this.selectionMethod) {
        case "country":
            return this.selectedCountry.getProperty('Country');
        case 'shapefile':
            return null;
        case 'coordinate':
            return null;
        default:
            $('#error-message').show().html('Please select a method of targeting first!');
            return 'null';
    }
};

precipitation.App.EE_URL = 'https://earthengine.googleapis.com';

precipitation.App.SELECTED_STYLE = {strokeWeight: 4};
precipitation.App.UNSELECTED_STYLE = {
    fillOpacity: 0.0,
    strokeColor: 'black',
    strokeWeight: 1
};

precipitation.App.OVERLAY_BASE_BUTTON_NAME = 'Create Overlay';

precipitation.App.GRAPH_BASE_BUTTON_NAME = 'Create Graph';

precipitation.App.DEFAULT_CENTER = {lng: 0.0, lat: 12.5};
precipitation.App.DEFAULT_ZOOM = 3;
precipitation.App.MAX_ZOOM = 14;

precipitation.App.CHIRPS_CLIMATE = 'UCSB-CHG/CHIRPS/DAILY';
precipitation.App.TERA_EVAPOTRANSPIRATION = 'MODIS/006/MOD16A2';

