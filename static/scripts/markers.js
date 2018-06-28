markers = {};

$(function () {
    $('.markers-table').on('click', '.remove-marker', function () {
        var tr = $(this).closest('tr');
        var title = tr.find('.title').html();
        console.log('Removing Marker: ' + title);
        var markers = precipitation.instance.markers;
        markers.forEach(function (marker) {
            if (marker.getTitle() === title) {
                marker.setMap(null);
                precipitation.instance.markers.splice(marker.index, 1);
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
        var map = precipitation.instance.map;
        precipitation.instance.markers.forEach(function (marker) {
            marker.setMap(map);
        });
    } else {
        precipitation.instance.markers.forEach(function (marker) {
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
    if (lat === '' || lng === '' || title === '') {
        $('#error-message').show().html('Please enter a valid Latitude, Longitude and Title');
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
        map: precipitation.instance.map,
        title: title
    });
    precipitation.instance.markers.push(marker);
    console.log('Added marker: ' + marker.getTitle());
    var tableContent = '<tr><td>' + lat + '</td><td>' + lng + '</td><td class="title">' + title + '</td><td><button class="btn btn-danger remove-marker">Remove</button></td></tr>';
    $('.markers-table tbody').append(tableContent);
};

/**
 * Returns JSON of all markers for EE
 */
markers.getJSON = function () {
    var features = $.map(precipitation.instance.markers, function (marker) {
        console.log(marker);
        var temp = {
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
        temp.properties.title = marker.getTitle();
        var position = marker.getPosition();
        temp.geometry.coordinates = [position.lat(), position.lng()];
        console.log(temp);
        return temp;
    });
    var data = {'features': features};
    var json = JSON.stringify(data);
    console.log(json);
    return json;
};

