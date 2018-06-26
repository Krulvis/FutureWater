markers = {};

$(function () {
    $('.markers-table').on('click', '.remove-marker', function () {
        var tr = $(this).closest('tr');
        var title = tr.find('.title').html();
        console.log('Removing Marker: ' + title);
        var markers = rainfall.instance.markers;
        markers.forEach(function (marker) {
            if (marker.getTitle() === title) {
                marker.setMap(null);
                rainfall.instance.markers.splice(marker.index, 1);
            }
        });
        tr.remove();
    });
});

/**
 * Enable or disable drawing the markers, used when switching styles
 * @param draw
 */
markers.draw = function (draw) {
    if (draw) {
        var map = rainfall.instance.map;
        rainfall.instance.markers.forEach(function (marker) {
            marker.setMap(map);
        });
    } else {
        rainfall.instance.markers.forEach(function (marker) {
            marker.setMap(null);
        });
    }
};

/**
 * Gets latLng from click
 * @param event
 * @returns {*[]}
 */
markers.addMarkerFromClick = function (event) {
    var lat = event.latLng.lat();
    var lng = event.latLng.lng();
    markers.addMarker(lat, lng, '[' + lat + ', ' + lng + ']');
};

/**
 * Adds a marker for filled in values
 */
markers.addMarkerFromForm = function () {
    var lat = $('#lat').val();
    var lng = $('#lng').val();
    var title = $('#title').val();
    if (lat === 'Latitude' || lng === 'Longitude') {
        $('#error-message').show().html('Please enter a valid Latitude or Longitude');
    } else {
        $('#error-message').hide();
        markers.addMarker(lat, lng, title);
    }
};

/**
 * Add marker to map and
 */
markers.addMarker = function (lat, lng, title) {
    //nameing
    var position = new google.maps.LatLng(lat, lng);
    var marker = new google.maps.Marker({
        position: position,
        map: rainfall.instance.map,
        title: title
    });
    rainfall.instance.markers.push(marker);
    console.log('Added marker: ' + marker.getTitle());
    var tableContent = '<tr><td>' + lat + '</td><td>' + lng + '</td><td class="title">' + title + '</td><td><button class="btn btn-danger remove-marker">Remove</button></td></tr>';
    $('.markers-table tbody').append(tableContent);
};

/**
 * Returns JSON of all markers for EE
 */
markers.getJSON = function () {
    var data = {'FeatureCollection': []};
    rainfall.instance.markers.forEach(function (marker) {
        var temp = markers.TEMPLATE;
        temp.properties.title = marker.getTitle();
        var position = marker.getPosition();
        temp.geometry.coordinates = [position.lat(), position.lng()];
        data.featureCollection.push(temp);
    });
    var json = JSON.stringify(data);
    console.log(json);
    return json;
};

markers.TEMPLATE = {
    "type": "Feature",
    "properties": {
        "title": "Point",
        "id": "point"
    },
    "geometry": {
        "type": "Point",
        "coordinates": []
    }
};

