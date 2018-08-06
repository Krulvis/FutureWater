statistics = {};

statistics.resetRadios = function (type) {
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

statistics.addTo = function (element) {
    if (element.find('.statistics-container').length === 0) {
        element.prepend(statistics.html);
    }
};

statistics.removeFrom = function (element) {
    element.find('.statistics-container').remove();
};

statistics.html = '<div class="statistics-container form-group">\n' +
    '                            <label class="bold" for="statistics">Choose Statistic</label>\n' +
    '                            <div id="statistics">\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="SUM" name="statistics" class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="SUM">Sum</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MEAN" name="statistics"\n' +
    '                                           class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="MEAN">Mean</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MIN" name="statistics"\n' +
    '                                           class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="MIN">Min</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MAX" name="statistics"\n' +
    '                                           class="custom-control-input"><label\n' +
    '                                        class="custom-control-label" for="MAX">Max</label>\n' +
    '                                </div>\n' +
    '                            </div>\n' +
    '                        </div>';