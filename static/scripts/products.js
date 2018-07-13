products = {};

products.resetRadios = function () {
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
            this.addTo(graphContent);
            this.removeFrom(overlayContent);
            break;
    }
};

products.addTo = function (element) {
    if (element.find('.products-container').length === 0) {
        element.prepend(products.html);
    }
};

products.removeFrom = function (element) {
    element.find('.products-container').remove();
};

products.html = '<div class="products-container form-group">\n' +
    '                            <label class="bold" for="products">Choose Product</label>\n' +
    '                            <div id="products">\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="TRMM" name="product" class="custom-control-input">\n' +
    '                                    <label class="custom-control-label" for="TRMM">TRMM</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="PERSIANN" name="product" class="custom-control-input">\n' +
    '                                    <label class="custom-control-label" for="PERSIANN">PERSIANN</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="CHIRPS" name="product" class="custom-control-input">\n' +
    '                                    <label class="custom-control-label" for="CHIRPS">CHIRPS</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="CFSV2" name="product" class="custom-control-input">\n' +
    '                                    <label class="custom-control-label" for="CFSV2">CFSV2</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="GLDAS" name="product" class="custom-control-input">\n' +
    '                                    <label class="custom-control-label" for="GLDAS">GLDAS</label>\n' +
    '                                </div>\n' +
    '                                <div class="custom-control custom-radio custom-control-inline">\n' +
    '                                    <input type="radio" id="MOD16" name="product" class="custom-control-input">\n' +
    '                                    <label class="custom-control-label" for="MOD16">MOD16</label>\n' +
    '                                </div>\n' +
    '                            </div>\n' +
    '                        </div>';