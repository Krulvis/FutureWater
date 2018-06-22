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
    this.polygons = [];
    this.targetRegion = null;
    this.drawingManager = this.createDrawingManager();

    //this.addCountries(countriesMapId, countriesToken);
    this.createCountries();
    this.map.data.addListener('click', this.handleCountryClick.bind(this));

    $(function () {
        $(".results").draggable();
    });

    $('#map-button').on('click', function (event) {
        rainfall.instance.addRainfall();
    });

    $('#graph-button').on('click', function (event) {
        rainfall.instance.addGraph();
    });

    // Register a click handler to hide the panel when the user clicks close.
    $('.results .close').click(this.hidePanel.bind(this));

    /**
     * Respond to radio button clicks (switching input style)
     */
    $('.radio-inline').on('click', this.switchStyle.bind(this));
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
            rainfall.instance.map.overlayMapTypes.clear();
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
            var title = this.selectionMethod === 'country' ? this.targetRegion : 'Polygon';
            $('.results .title').show().text(title);
            button.attr('value', rainfall.App.GRAPH_BASE_BUTTON_NAME);
            console.log(data);
            this.showChart(data)
        }
    }).bind(this));
};

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
rainfall.App.prototype.handleCountryClick = function (event) {
    if (this.selectionMethod === 'country') {
        var feature = event.feature;
        var name = feature.getProperty('name');
        console.log('Clicked: ' + name);
        this.targetRegion = name;
        this.map.data.revertStyle();
        this.map.data.overrideStyle(feature, rainfall.App.SELECTED_STYLE);
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
 * Drawing manager for drawing polygons on the map
 * @returns {google.maps.drawing.DrawingManager}
 */
rainfall.App.prototype.createDrawingManager = function () {
    var drawingManagerOptions = {
        drawingControl: false,
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        polygonOptions: {
            fillColor: '#2c3e50',
            strokeColor: '#2c3e50'
        }
    };
    var drawingManager = new google.maps.drawing.DrawingManager(drawingManagerOptions);

    /**
     * Add to google maps for completion listener
     */
    google.maps.event.addListener(
        drawingManager, 'overlaycomplete',
        (function (event) {
            this.finishedPolygon(event.overlay);
        }).bind(this));

    return drawingManager;
};

/**
 * Called when overlay is complete, Polygon is finished
 * @param opt_overlay Polygon
 */
rainfall.App.prototype.finishedPolygon = function (polygon) {
    this.targetRegion = polygon;
    this.polygons.push(polygon);
};

/**
 * Remove all placed polygons
 */
rainfall.App.prototype.removePolygons = function () {
    console.log('Removing polygons');
    this.polygons.forEach(function (polygon) {
        polygon.setMap(null);
    });
};

/**
 * Removes previously added Overlay Map Types (Used to remove Map Overlay Rainfall)
 */
rainfall.App.prototype.clearOverlays = function () {
    var overlays = this.map.overlayMapTypes;
    while (overlays[0]) {
        overlays.pop().setMap(null);
    }
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
    var style = $('input[type=radio]:checked');
    console.log(style.val());
    this.selectionMethod = style.val();
    this.targetRegion = null;
    this.clearOverlays();
    $('#map-button').attr('value', rainfall.App.OVERLAY_BASE_BUTTON_NAME);
    $('#graph-button').attr('value', rainfall.App.GRAPH_BASE_BUTTON_NAME);
    if (style.val() === 'polygon') {
        this.map.data.revertStyle();
        this.drawingManager.setMap(this.map);
        this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    } else {
        this.removePolygons();
        this.drawingManager.setMap(null);
        this.drawingManager.setDrawingMode(null);
    }
};

/**
 * Returns target, JSON encoded for polygons, regular for country names
 */
rainfall.App.prototype.getTarget = function () {
    if (this.selectionMethod === 'country') {
        return this.targetRegion
    } else {
        var dict = {
            "type": "Feature",
            "properties": {
                "title": "Polygon",
                "id": "polygon"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": []
            }
        };
        var mutliCoords = [];
        this.targetRegion.getPaths().forEach(function (path) {
            var coords = [];
            path.getArray().forEach(function (coordinate) {
                var coord = [coordinate.lng(), coordinate.lat()];
                coords.push(coord);
            });
            mutliCoords.push(coords);
        });
        dict.geometry.coordinates = mutliCoords;
        console.log(dict);
        return JSON.stringify(dict, null, 2)
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

