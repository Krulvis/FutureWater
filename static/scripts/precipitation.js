precipitation = {};

precipitation.boot = function (key) {
    // Load external libraries.
    //google.load('visualization', '1', {packages: ["corechart"]});
    google.load('maps', '3', {'other_params': 'key=' + key + '&libraries=drawing'});

    google.setOnLoadCallback(function () {
        google.charts.load("current", {packages: ['corechart']});
        google.charts.setOnLoadCallback(function () {
            precipitation.instance = new precipitation.App();
            precipitation.instance.initVals();
        });

    });
};

precipitation.App = function () {
    this.map = this.createMap();

    //Some styling (responsiveness of results panel)
    var results = $('.results');
    results.draggable().resizable();
    results.on('resizestop', function () {
        console.log('Resize complete');
        precipitation.instance.showChart();
    });

    //Get GeoJSON for all countries
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
    $('.method-container .nav-item').on('click', this.switchStyle.bind(this));
    $('.create-buttons .nav-item').on('click', this.switchOutput.bind(this));

    //Adds a marker for given input
    $('.add-marker').on('click', markers.addMarkerFromForm.bind(this));

    //Add functionality to buttons
    $('#overlay-button').on('click', function (event) {
        precipitation.instance.getOverlay();
    });

    $('#graph-button').on('click', function (event) {
        precipitation.instance.getGraph();
    });

    $('#download-csv-btn').click(function () {
        var csvFormattedDataTable = precipitation.App.graphToCSV(precipitation.instance.chartData);
        var encodedUri = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csvFormattedDataTable);
        this.href = encodedUri;
        this.download = 'table-data.csv';
        this.target = '_blank';
    });

    this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(document.getElementById('legend'));
};

/**
 * Set the initial Values to use
 */
precipitation.App.prototype.initVals = function () {
    this.targetRegion = null;
    this.selectedCountry = null;
    this.markers = [];
    this.selectionMethod = 'country';
    this.selectionType = 'graph';
    this.chartData = null;
    this.chartTitle = 'Chart';
    timesteps.resetRadios(this.selectionType);
    calculations.resetRadios(this.selectionType);
    products.resetRadios(this.selectionType);

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
    var overlay = $('#overlay');
    var downloadImg = $('.download-img');
    var downloadCSV = $('.download-csv');
    var product = this.getProduct();
    var timestep = this.getTimestep();
    var calculation = this.getCalculation();
    if (!this.checkRegion(false, product, calculation)) {
        return;
    }
    $.ajax({
        url: '/overlay?startDate=' + startDate + '&endDate=' + endDate + '&method=' + this.selectionMethod + '&product=' + product + '&calculation=' + calculation + '&target=' + this.getTarget() + '&timestep=' + timestep,
        method: 'GET',
        beforeSend: function () {
            button.html('Loading map overlay...');
            downloadImg.hide();
            downloadCSV.hide();
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
            $('#error-message').show().html('Map is being drawn... Please wait before drawing new map!');
            button.html(precipitation.App.OVERLAY_BASE_BUTTON_NAME);
            var jsonObj = $.parseJSON(data);
            var mapId = jsonObj['mapid'];
            var token = jsonObj['token'];
            $('#legend-max span').html(precipitation.App.format(jsonObj['max']));
            $('#legend-min span').html(precipitation.App.format(jsonObj['min']));
            downloadImg.show();
            $('#download-img-btn').attr("href", jsonObj['download_url']);
            this.addOverlay(mapId, token, calculation);
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
    var graph = $('#graph');
    var downloadImg = $('.download-img');
    var downloadCSV = $('.download-csv');
    var product = this.getProduct();
    var calculation = this.getCalculation();
    var timestep = this.getTimestep();
    if (!this.checkRegion(true, product, calculation)) {
        return;
    }
    $.ajax({
        url: '/graph?startDate=' + startDate + '&endDate=' + endDate + '&method=' + this.selectionMethod
        + '&product=' + product + '&calculation=' + calculation + '&target=' + this.getTarget() + '&timestep=' + timestep,
        method: 'GET',
        beforeSend: function () {
            downloadCSV.hide();
            downloadImg.hide();
            button.html('Loading...');
        }, error: function (data) {
            button.html('error');
            $('#error-message').show().html(data['error']);
        }
    }).done((function (data) {
        if (data['error']) {
            button.html(precipitation.App.GRAPH_BASE_BUTTON_NAME);
            $('#error-message').show().html(data['error']);
        } else {
            button.html(precipitation.App.GRAPH_BASE_BUTTON_NAME);
            this.chartTitle = this.selectionMethod === 'country' ? this.selectedCountry.getProperty('Country') : this.selectionMethod === 'coordinate' ? 'Markers' : 'ShapeFile';
            console.log(data);
            downloadCSV.show();
            this.chartData = data;
            this.showChart();
        }
    }).bind(this));
};

/**
 * Returns true if anything is selected
 * @returns {boolean}
 */
precipitation.App.prototype.checkRegion = function (graph, product, calculation) {
    var error = $('#error-message');
    error.show().html('');
    switch (this.selectionMethod) {
        case 'country':
            if (this.selectedCountry === null) {
                error.show().html('Select a Country first!');
                return false;
            } else if (!graph && (calculation === 'null' || product === 'null')) {
                error.show().html('Select a calculation and product first!')
            }
            break;
        case 'coordinate':
            if (this.markers.length === 0) {
                error.show().html('Create a Marker first (or click on map)!');
                return false;
            } else if (graph && product === 'null') {
                error.show().html('Select a product first!');
                return false;
            }
            break;
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

    else if (this.selectionMethod === 'country') {
        var feature = event.feature;
        var name = feature.getProperty('Country');
        console.log('Clicked: ' + name);
        this.selectedCountry = feature;
        this.map.data.revertStyle();
        this.map.data.overrideStyle(feature, precipitation.App.SELECTED_STYLE);
        $('#selected-country').val(name);
    }
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
precipitation.App.prototype.showChart = function () {
    $('.results').show();
    $('.results .title').show().text(this.chartTitle);
    var data = google.visualization.arrayToDataTable(this.chartData);
    var wrapper = new google.visualization.ChartWrapper({
        chartType: 'LineChart',
        dataTable: data,
        options: {
            title: 'Precipitation over time',
            //curveType: 'function',
            legend: {position: 'bottom'},
            titleTextStyle: {fontName: 'Roboto'},
            hAxis: {title: 'Time'},
            vAxis: {title: 'Precipitation (mm)'}
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
 * @param calculation
 */
precipitation.App.prototype.addOverlay = function (eeMapId, eeToken, calculation) {
    var legend = $('#legend');
    legend.show();
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
    $('.download').hide();
    $('#legend').hide();
    /*
    Reset buttons
     */
    this.clearOverlays();
    $('#overlay-button').html(precipitation.App.OVERLAY_BASE_BUTTON_NAME);
    $('#graph-button').html(precipitation.App.GRAPH_BASE_BUTTON_NAME);

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
    timesteps.resetRadios(this.selectionType);
    calculations.resetRadios(this.selectionType);
    products.resetRadios(this.selectionType);
};

/**
 * Changes the option menu depending on which type= [overlay/graph] is clicked
 * @param event
 */
precipitation.App.prototype.switchOutput = function (event) {
    var method = this.selectionMethod;
    var type = $(event.target).text().toLowerCase();
    this.selectionType = type;
    timesteps.resetRadios(type);
    calculations.resetRadios(type);
    products.resetRadios(type);
};

/**
 * Returns the selected Analysing Method
 * @returns {string}
 */
precipitation.App.prototype.getProduct = function () {
    var container = $('.products-container');
    if (container.length === 0) {
        return 'null';
    } else {
        var elems = container.find('input:checked');
        console.log(elems);
        var ids = [];
        elems.each(function () {
            ids.push($(this).attr('id').toUpperCase());
        });
        return ids.join(',');
    }
};

/**
 * Returns the selected Analysing Method
 * @returns {string}
 */
precipitation.App.prototype.getTimestep = function () {
    var container = $('.timesteps-container');
    if (container.length === 0) {
        return 'null';
    } else {
        var id = container.find('input:radio:checked').attr('id');
        if (id === undefined) {
            return 'null';
        }
        return id.toLowerCase();
    }
};

/**
 * Returns the selected Analysing Method
 * @returns {string}
 */
precipitation.App.prototype.getCalculation = function () {
    var container = $('.calculations-container');
    if (container.length === 0) {
        return 'null';
    } else {
        var id = container.find('input:radio:checked').attr('id');
        if (id === undefined) {
            return 'null';
        }
        return id.toLowerCase();
    }
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
            return markers.getJSON();
        default:
            $('#error-message').show().html('Please select a method of targeting first!');
            return 'null';
    }
};

/**
 * Exports the chart data to CSV cuz dataTableToCSV is fucking gone...
 * @returns {*|string}
 */
precipitation.App.graphToCSV = function (dataTable) {
    var json = dataTable;
    var fields = Object.keys(json[0]);
    var replacer = function (key, value) {
        return value === null ? '' : value
    };
    var csv = json.map(function (row) {
        return fields.map(function (fieldName) {
            return JSON.stringify(row[fieldName], replacer)
        }).join(',')
    });
    csv.unshift(fields.join(','));
    return csv.join('\r\n');
};

precipitation.App.format = function (value) {
    return parseFloat(Math.round(value * 100) / 100).toFixed(2);
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

