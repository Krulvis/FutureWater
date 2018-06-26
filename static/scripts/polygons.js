polygons = {};

polygons.Selector = function () {
    this.selection = [];
    this.drawingManager = this.createDrawingManager();
};

/**
 * Drawing manager for drawing polygons on the map
 * @returns {google.maps.drawing.DrawingManager}
 */
polygons.Selector.prototype.createDrawingManager = function () {
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

    /**
     * Remove current polygon on right-click
     */
    google.maps.event.addListener(
        drawingManager, 'rightclick',
        (function (event) {
            this.removePolygons();
            console.log('Hi there');
        }).bind(this));

    return drawingManager;
};

/**
 * Called when overlay is complete, Polygon is finished
 * @param opt_overlay Polygon
 */
polygons.Selector.prototype.finishedPolygon = function (polygon) {
    this.removePolygons();
    //this.targetRegion = polygon;
    this.selection.push(polygon);
};

/**
 * Remove all placed polygons
 */
polygons.Selector.prototype.removePolygons = function () {
    console.log('Removing polygons');
    this.selection.forEach(function (polygon) {
        polygon.setMap(null);
    });
};

polygons.Selector.prototype.getJSON = function () {
    //Create GeoJSON importable by EE
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
    
    /**
     * Needs to be adjusted for re-use
     */
    this.selection.forEach(function (polygon) {
        polygon.getPaths().forEach(function (path) {
            var coords = [];
            path.getArray().forEach(function (coordinate) {
                var coord = [coordinate.lng(), coordinate.lat()];
                coords.push(coord);
            });
            mutliCoords.push(coords);
        });
    });
    dict.geometry.coordinates = mutliCoords;
    console.log(dict);
    return JSON.stringify(dict, null, 2)
};