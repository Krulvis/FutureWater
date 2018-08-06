timesteps = {};

timesteps.resetRadios = function (type) {
    var options = $('.create-options');
    this.removeFrom(options);
    if (type === 'graph') {
        switch (precipitation.instance.selectionMethod) {
            case 'country':
                this.addTo(type, options);
                break;
            case 'shapefile':
                this.addTo(type, options);
                break;
            case 'coordinate':
                break;
        }
    } else if (type === 'overlay') {
        switch (precipitation.instance.selectionMethod) {
            case 'country':
                this.addTo(type, options);
                break;
            case 'shapefile':
                this.addTo(type, options);
                break;
            case 'coordinate':
                break;
        }
    }
};

timesteps.addTo = function (type, element) {
    if (element.find('.timesteps-container').length === 0) {
        element.prepend(timesteps.html(type));
    }
};

timesteps.removeFrom = function (element) {
    element.find('.timesteps-container').remove();
};

timesteps.html = function (type) {
    var disabled = type === 'overlay' ? 'disabled' : '';
    var checked = type === 'overlay' ? 'checked' : '';
    return '<div class="timesteps-container form-group">\n' +
        '                            <label class="bold" for="timesteps">Choose Time Step</label>\n' +
        '                            <div id="timesteps">\n' +
        '                                <div class="custom-control custom-radio custom-control-inline">\n' +
        '                                    <input type="radio" id="DAY" name="timesteps" class="custom-control-input" ' + checked + '><label\n' +
        '                                        class="custom-control-label" for="DAY">Daily</label>\n' +
        '                                </div>\n' +
        '                                <div class="custom-control custom-radio custom-control-inline">\n' +
        '                                    <input type="radio" id="MONTH" name="timesteps"\n' +
        '                                           class="custom-control-input" ' + disabled + '><label\n' +
        '                                        class="custom-control-label" for="MONTH">Monthly</label>\n' +
        '                                </div>\n' +
        '                                <div class="custom-control custom-radio custom-control-inline">\n' +
        '                                    <input type="radio" id="YEAR" name="timesteps"\n' +
        '                                           class="custom-control-input" ' + disabled + '><label\n' +
        '                                        class="custom-control-label" for="YEAR">Yearly</label>\n' +
        '                                </div>\n' +
        '                            </div>\n' +
        '                        </div>';
};