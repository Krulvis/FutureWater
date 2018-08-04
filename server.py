#!/usr/bin/env python
"""Web server for the Trendy Lights application.

The overall architecture looks like:

               server.py         script.js
 ______       ____________       _________
|      |     |            |     |         |
|  EE  | <-> | App Engine | <-> | Browser |
|______|     |____________|     |_________|
     \                               /
      '- - - - - - - - - - - - - - -'

The code in this file runs on App Engine. It's called when the user loads the
web page and when details about a polygon are requested.

Our App Engine code does most of the communication with EE. It uses the
EE Python library and the service account specified in config.py. The
exception is that when the browser loads map tiles it talks directly with EE.

The basic flows are:

1. Initial page load

When the user first loads the application in their browser, their request is
routed to the get() function in the MainHandler class by the framework we're
using, webapp2.

The get() function sends back the main web page (from index.html) along
with information the browser needs to render an Earth Engine map and
the IDs of the polygons to show on the map. This information is injected
into the index.html template through a templating engine called Jinja2,
which puts information from the Python context into the HTML for the user's
browser to receive.

Note: The polygon IDs are determined by looking at the static/polygons
folder. To add support for another polygon, just add another GeoJSON file to
that folder.

2. Getting details about a polygon

When the user clicks on a polygon, our JavaScript code (in static/script.js)
running in their browser sends a request to our backend. webapp2 routes this
request to the get() method in the DetailsHandler.

This method checks to see if the details for this polygon are cached. If
yes, it returns them right away. If no, we generate a Wikipedia URL and use
Earth Engine to compute the brightness trend for the region. We then store
these results in a cache and return the result.

Note: The brightness trend is a list of points for the chart drawn by the
Google Visualization API in a time series e.g. [[x1, y1], [x2, y2], ...].

Note: memcache, the cache we are using, is a service provided by App Engine
that temporarily stores small values in memory. Using it allows us to avoid
needlessly requesting the same data from Earth Engine over and over again,
which in turn helps us avoid exceeding our quota and respond to user
requests more quickly.

"""

import json
import os
import sys
from httplib import HTTPException

import jinja2
import webapp2
from google.appengine.api import memcache
from google.appengine.api import urlfetch

import config
import ee


###############################################################################
#                             Web request handlers.                           #
###############################################################################


class MainHandler(webapp2.RequestHandler):
    """A servlet to handle requests to load the main web page."""

    def get(self, path=''):
        """Returns the main web page, populated with EE map."""
        template_values = {
            'key': config.KEY
        }
        template = JINJA2_ENVIRONMENT.get_template('index.html')
        self.response.out.write(template.render(template_values))


class OverlayHandler(webapp2.RequestHandler):

    def get(self):
        start_date = self.request.get('startDate')
        end_date = self.request.get('endDate')
        target = self.request.get('target')
        product = self.request.get('product')
        calculation = self.request.get('calculation')
        method = self.request.get('method')
        values = {}
        if method == 'country':
            feature = GetCountryFeature(target)
            values['center'] = feature.centroid()
        elif method == 'shapefile':
            feature = GetShapeFileFeature(target)
            values['center'] = feature.centroid()
        else:
            json_data = json.loads(target)
            print(json_data)
            feature = ee.Feature(json_data)

        try:
            collection = GetOverlayImageCollection(start_date, end_date, product)
            calced = GetCalculatedCollection(collection, calculation)
            min_max = calced.reduce(ee.Reducer.minMax())
            min = GetMin(min_max, feature)
            max = GetMax(min_max, feature)
            overlay = GetOverlayImage(calced, feature, min, max)
            data = overlay.getMapId()
            values = {
                'mapid': data['mapid'],
                'token': data['token'],
                'min': min,
                'max': max,
                'download_url': overlay.getDownloadURL()
            }
        except (ee.EEException, HTTPException):
            # Handle exceptions from the EE client library.
            e = sys.exc_info()[0]
            values['error'] = ErrorHandling(e)
        finally:
            self.response.headers['Content-Type'] = 'application/json'
            self.response.out.write(json.dumps(values))


class GraphHandler(webapp2.RequestHandler):

    def get(self):
        name = self.request.relative_url
        start_date = self.request.get('startDate')
        end_date = self.request.get('endDate')
        target = self.request.get('target')
        product = self.request.get('product')
        calculation = self.request.get('calculation')
        timestep = self.request.get('timestep')
        method = self.request.get('method')
        if method == 'coordinate':
            data = json.loads(target)
            print(data)
            features = data['features']
            content = GetPointsLineSeries(str(name), start_date, end_date, product, features)
        else:
            content = GetOverlayGraphSeries(str(name), start_date, end_date, target, method, product.split(","),
                                            timestep)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(content)


class SFHandler(webapp2.RequestHandler):

    def get(self):
        link = self.request.get('link')
        fc = ee.FeatureCollection(link)
        print(fc.getInfo())
        data = {}
        data['success'] = 'true'
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(json.dumps(data))


class TestHandler(webapp2.RequestHandler):

    def get(self):
        path = os.path.join(os.path.split(__file__)[0], 'static/shapefiles/Kalanga2.zip')
        with open(path) as f:
            features = ee.FeatureCollection(f)
            print(features.getInfo())


# http://webapp-improved.appspot.com/tutorials/quickstart.html
app = webapp2.WSGIApplication([
    ('/overlay', OverlayHandler),
    ('/graph', GraphHandler),
    ('/test', TestHandler),
    ('/shapefile', SFHandler),
    ('/', MainHandler),
])


###############################################################################
#                                Overlay                                      #
###############################################################################

def GetOverlayImageCollection(start_date, end_date, product_name):
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    product = GetProductForName(product_name)
    return product['collection'].filterDate(start_date, end_date)


def GetCalculatedCollection(images, calculation):
    if calculation == 'mean':
        return images.mean()
    if calculation == 'sum':
        return images.sum()
    if calculation == 'min':
        return images.min()
    if calculation == 'max':
        return images.max()


def GetMax(min_max, region):
    maximum = min_max.select('max').reduceRegion(ee.Reducer.max(), region, 5000)
    return ee.Number(maximum.get('max')).getInfo()


def GetMin(min_max, region):
    minmum = min_max.select('min').reduceRegion(ee.Reducer.min(), region, 5000)
    return ee.Number(minmum.get('min')).getInfo()


def GetOverlayImage(images, region, min, max):
    """Map for displaying summed up images of specified measurement"""
    return images.clip(region).visualize(min=min, max=max, palette='FF00E7, FF2700, FDFF92, 0000FF, 000000')


###############################################################################
#                                Graph For Points.                            #
###############################################################################

def GetPointsLineSeries(details_name, start_date, end_date, product, point_features):
    # Get from cache
    json_data = memcache.get(details_name)
    if json_data is not None:
        print('From Cache:')
        print(json_data)
        return json_data

    # Else build new dataset
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    months = ee.List.sequence(0, end_date.difference(start_date, 'month').toInt())
    product = GetProductForName(product)

    point_features = map(ee.Feature, point_features)  # Map to ee.Feature (loads GeoJSON)
    details = {}

    try:
        print('NOT CACHE:')
        for point in point_features:
            details[point.getInfo()['properties']['title']] = GetPointData(start_date, months, product, point)
        print(details)
        graph = OrderForGraph(details)
        json_data = json.dumps(graph)
        # Store the results in memcache.
        memcache.add(details_name, json_data, MEMCACHE_EXPIRATION)
    except (ee.EEException, HTTPException):
        # Handle exceptions from the EE client library.
        e = sys.exc_info()[0]
        details['error'] = ErrorHandling(e)
        json_data = json.dumps(details)
    finally:
        # Send the results to the browser.
        print("Done getting JSON")
        return json_data


def GetPointData(start_date, months, product, point_feature):
    # Create base months
    def CalculateForMonth(count):
        m = start_date.advance(count, 'month')
        img = product['collection'].filterDate(m, ee.Date(m).advance(1, 'month')).sum().reduceRegion(
            ee.Reducer.mean(), point_feature.geometry(),
            product['scale'])
        return ee.Feature(None, {
            'system:time_start': m.format('MM-YYYY'),
            'value': img.values().get(0)
        })

    chart_data = months.map(CalculateForMonth).getInfo()

    def ExtractMean(feature):
        return [feature['properties']['system:time_start'], feature['properties']['value']]

    chart_data = map(ExtractMean, chart_data)
    print(chart_data)
    return chart_data


###############################################################################
#                                Graph For Regions.                           #
###############################################################################

def GetOverlayGraphSeries(details_name, start_date, end_date, target, method, products, timestep):
    """Returns data to draw graphs with"""
    json_data = memcache.get(details_name)
    # If we've cached details for this polygon, return them.
    if json_data is not None:
        print('From Cache:')
        print(json_data)
        return json_data

    # Else build new dictionary
    details = {}
    if method == 'country':
        region = GetCountryFeature(target)
    elif method == 'shapefile':
        region = GetShapeFileFeature(target)
    else:
        json_data = json.loads(target)
        print(json_data)
        region = ee.Feature(json_data)

    # Try building json dict for each method
    try:
        print('NOT CACHE:')
        for product in PRODUCTS:
            if product['name'] in products:
                details[product['name']] = ComputeGraphSeries(start_date, end_date, region, product, timestep)
        print(details)
        graph = OrderForGraph(details)
        json_data = json.dumps(graph)
        # Store the results in memcache.
        memcache.add(details_name, json_data, MEMCACHE_EXPIRATION)
    except (ee.EEException, HTTPException):
        # Handle exceptions from the EE client library.
        e = sys.exc_info()[0]
        details['error'] = ErrorHandling(e)
        json_data = json.dumps(details)
    finally:
        # Send the results to the browser.
        return json_data


def ComputeGraphSeries(start_date, end_date, region, product, timestep):
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    months = ee.List.sequence(0, end_date.difference(start_date, timestep).toInt())

    # Create base months
    def CalculateTimeStep(count):
        m = start_date.advance(count, timestep)
        img = product['collection'].filterDate(m, ee.Date(m).advance(1, timestep)).sum().reduceRegion(
            ee.Reducer.mean(), region,
            product['scale'])
        return ee.Feature(None, {
            'system:time_start': m.format(
                'DD-MM-YYYY' if timestep == 'day' else 'MM-YYYY' if timestep == 'month' else 'YYYY'),
            'value': img.values().get(0)
        })

    chart_data = months.map(CalculateTimeStep).getInfo()

    def ExtractMean(feature):
        return [feature['properties']['system:time_start'], feature['properties']['value']]

    chart_data = map(ExtractMean, chart_data)
    print(chart_data)
    return chart_data


###############################################################################
#                                   Helpers.                                  #
###############################################################################

def GetProductForName(name):
    for p in PRODUCTS:
        if p['name'] == name:
            return p
    return PRODUCTS[0]


def GetCountryFeature(country):
    """Returns an ee.Feature for the polygon with the given ID."""
    # Note: The polygon IDs are read from the filesystem in the initialization
    # section below. "sample-id" corresponds to "static/polygons/sample-id.json".
    return COUNTRIES.filter(ee.Filter.inList('Country', [country])).geometry().dissolve()
    # path = COUNTRIES_PATH
    # path = os.path.join(os.path.split(__file__)[0], path)
    # with open(path) as f:
    #     data = json.load(f)
    #     countries = [ee.Feature(k) for k in data["features"]]
    #     collections = ee.FeatureCollection(countries)
    #     return collections.filterMetadata('Country', 'equals', country)


def GetShapeFileFeature(shapefile):
    return ee.FeatureCollection(shapefile).geometry().dissolve()


def OrderForGraph(details):
    """Generates a multi-dimensional array of information to be displayed in the Graphs"""
    # Create first row of columns
    first_row = ['Date']
    for i in details:
        first_row.append(i)

    # Build array of months (Assumes Month (mm-yyyy) to be first, and have the value as second element per row
    first = details[details.keys()[0]]
    months = [first[i][0] for i in range(len(first))]
    print(months)

    rows = [len(first)]
    rows[0] = first_row

    # Create rows and add to main array
    for index in range(len(months)):
        row = [months[index]]
        for i in details:
            value = details[i][index][1]
            row.append(0.0 if value is None else value)
        rows.append(row)

    print(rows)

    return rows


def ErrorHandling(e):
    print('Error getting graph data ERROR CAUGHT')
    print(str(e))
    return 'Area too large' if e is HTTPException else str(e)


###############################################################################
#                                   Constants.                                #
###############################################################################


# Memcache is used to avoid exceeding our EE quota. Entries in the cache expire
# 24 hours after they are added. See:
# https://cloud.google.com/appengine/docs/python/memcache/
MEMCACHE_EXPIRATION = 60 * 60 * 24

COUNTRIES_PATH = 'static/polygons/countries2.json'

###############################################################################
#                               Initialization.                               #
###############################################################################


# Use our App Engine service account's credentials.
EE_CREDENTIALS = ee.ServiceAccountCredentials(
    config.EE_ACCOUNT, config.EE_PRIVATE_KEY_FILE)

# Create the Jinja templating system we use to dynamically generate HTML. See:
# http://jinja.pocoo.org/docs/dev/
JINJA2_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)),
    autoescape=True,
    extensions=['jinja2.ext.autoescape'])

# Initialize the EE API.
ee.Initialize(EE_CREDENTIALS)
urlfetch.set_default_fetch_deadline(80)

###############################################################################
#                               Building the ImageCollections.                #
###############################################################################
COUNTRIES = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw')


def Multiply(i, value):
    return i.multiply(value).copyProperties(i, ['system:time_start'])


TRMM = ee.ImageCollection('TRMM/3B42').select('precipitation').map(
    lambda i: Multiply(i, 3))
MOD16 = ee.ImageCollection('MODIS/006/MOD16A2').select('ET').map(
    lambda i: Multiply(i, 0.1))
PERSIANN = ee.ImageCollection('NOAA/PERSIANN-CDR')
CHIRPS = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
CFSV2 = ee.ImageCollection('NOAA/CFSV2/FOR6H').select('Precipitation_rate_surface_6_Hour_Average').map(
    lambda i: Multiply(i, 60 * 60 * 6))
GLDAS = ee.ImageCollection('NASA/GLDAS/V021/NOAH/G025/T3H').select('Rainf_tavg').map(
    lambda i: Multiply(i, 60 * 60 * 3))

PRODUCTS = [
    {
        'name': 'CHIRPS',
        'collection': CHIRPS,
        'scale': 5000
    },
    {
        'name': 'PERSIANN',
        'collection': PERSIANN,
        'scale': 5000
    },
    {
        'name': 'THRP',
        'collection': TRMM,
        'scale': 30000
    },
    {
        'name': 'CFSV2',
        'collection': CFSV2,
        'scale': 30000
    },
    {
        'name': 'GLDAS',
        'collection': GLDAS,
        'scale': 30000
    }
]
# {
#     'name': 'MOD16',
#     'collection': MOD16,
#     'scale': 500
#
# }
