calculations = {};

calculations.resetRadios = function (type) {
    var options = $('.create-options');
    this.removeFrom(options);
    if (type === 'graph') {
        //Should be removed from all
    } else if (type === 'overlay') {
        switch (precipitation.instance.selectionMethod) {
            case 'country':
                this.addTo(options);
                break;
            case 'shapefile':
                this.addTo(options);
                break;
            case 'coordinate':
                break;
        }
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
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MIN" name="calculations"\n' +
    '                                           class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="MIN">Min</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MAX" name="calculations"\n' +
    '                                           class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="MAX">Max</label>\n' +
    '                                </div>\n' +
    '                            </div>\n' +
    '                        </div>';