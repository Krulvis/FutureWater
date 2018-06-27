calculations = {};

calculations.resetRadios = function () {
    var overlayTab = $('#overlay-tab');
    var graphTab = $('#graph-tab');
    var graphContent = $('#graph');
    var overlayContent = $('#overlay');

    switch (precipitation.instance.selectionMethod) {
        case 'country':
            //Overlay
            this.addTo(overlayContent);
            this.removeFrom(graphContent);
            break;
        case 'shapefile':
            this.addTo(overlayContent);
            this.removeFrom(graphContent);
            break;
        case 'coordinate':
            this.removeFrom(overlayContent);
            this.removeFrom(graphContent);
            break;
    }
};

calculations.addTo = function (element) {
    if (element.find('.calculations-container').length === 0) {
        element.prepend(calculations.html);
    }
};

calculations.removeFrom = function (element) {
    element.find('.calculations-container').remove();
};

calculations.html = '<div class="calculations-container form-group">\n' +
    '                            <label class="bold" for="calculations">Choose Calculation</label>\n' +
    '                            <div id="calculations">\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="SUM" name="calculations" class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="SUM">Sum</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MEAN" name="calculations"\n' +
    '                                           class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="MEAN">Mean</label>\n' +
    '                                </div>\n' +
    '                            </div>\n' +
    '                        </div>';