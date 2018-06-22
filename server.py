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
        self.response.out.write(template.render())


class RainfallHandler(webapp2.RequestHandler):

    def get(self):
        start_date = self.request.get('startDate')
        end_date = self.request.get('endDate')
        target = self.request.get('target')
        style = self.request.get('style')
        if style == 'country':
            region = GetCountryFeature(target)
        else:
            json_data = json.loads(target)
            print(json_data)
            region = ee.Feature(json_data)
        data = GetRainMapID(start_date, end_date, region)
        values = {
            'mapid': data['mapid'],
            'token': data['token']
        }
        self.response.out.write(json.dumps(values))


class CountriesHandler(webapp2.RequestHandler):

    def get(self):
        start_date = self.request.get('startDate')
        end_date = self.request.get('endDate')
        target = self.request.get('target')
        style = self.request.get('style')
        content = GetMonthlySeries(start_date, end_date, target, style)
        self.response.headers['Content-Type'] = 'application/json'
        self.response.out.write(content)


# http://webapp-improved.appspot.com/tutorials/quickstart.html
app = webapp2.WSGIApplication([
    ('/rainfall', RainfallHandler),
    ('/countries', CountriesHandler),
    ('/', MainHandler),
])


###############################################################################
#                                   Helpers.                                  #
###############################################################################


def GetMonthlySeries(start_date, end_date, target, style):
    """Returns data to draw graphs with"""
    details_name = target + start_date + end_date
    json_data = memcache.get(details_name)
    # If we've cached details for this polygon, return them.
    if json_data is not None:
        print('From Cache:')
        print(json_data)
        return json_data

    # Else build new dictionary
    details = {}
    if style == 'country':
        region = GetCountryFeature(target)
    else:
        json_data = json.loads(target)
        print(json_data)
        region = ee.Feature(json_data)

    # Try building json dict for each method
    try:
        print('NOT CACHE:')
        for method in METHODS:
            details[method['name']] = ComputeMonthlyTimeSeries(start_date, end_date, region, method)
        print(details)
        graph = OrderForGraph(details)
        json_data = json.dumps(graph)
        # Store the results in memcache.
        memcache.add(details_name, json_data, MEMCACHE_EXPIRATION)
    except (ee.EEException, webapp2.HTTPException) as e:
        # Handle exceptions from the EE client library.
        print('Error getting graph data')
        details['error'] = str(e)
        print(details['error'])

    # Send the results to the browser.
    return json_data


def ComputeMonthlyTimeSeries(start_date, end_date, region, method):
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    region = region.geometry()
    months = ee.List.sequence(0, end_date.difference(start_date, 'month').toInt())

    # Create base months
    def CalculateForMonth(count):
        m = start_date.advance(count, 'month')
        img = method['collection'].filterDate(m, ee.Date(m).advance(1, 'month')).sum().reduceRegion(
            ee.Reducer.mean(), region,
            method['scale'])
        return ee.Feature(None, {
            'system:time_start': m.format('MM-YYYY'),
            'value': img.values().get(0)
        })

    urlfetch.set_default_fetch_deadline(59)
    chart_data = months.map(CalculateForMonth).getInfo()

    def ExtractMean(feature):
        return [feature['properties']['system:time_start'], feature['properties']['value']]

    chart_data = map(ExtractMean, chart_data)
    print(chart_data)
    return chart_data


def OrderForGraph(details):
    """Generates a multi-dimensional array of information to be displayed in the Graphs"""
    # Create first row of columns
    first_row = ['Month']
    for i in details:
        first_row.append(i)

    # Build array of months
    first = details[details.keys()[0]]
    months = [first[i][0] for i in range(len(first))]
    print(months)

    rows = [len(first)]
    rows[0] = first_row

    # Create rows and add to main array
    for index in range(len(months)):
        row = [months[index]]
        for i in details:
            row.append(details[i][index][1])
        rows.append(row)

    print(rows)

    return rows


def GetCountryFeature(country):
    """Returns an ee.Feature for the polygon with the given ID."""
    # Note: The polygon IDs are read from the filesystem in the initialization
    # section below. "sample-id" corresponds to "static/polygons/sample-id.json".
    path = COUNTRIES_PATH
    path = os.path.join(os.path.split(__file__)[0], path)
    with open(path) as f:
        data = json.load(f)
        countries = [ee.Feature(k) for k in data["features"]]
        collections = ee.FeatureCollection(countries)
        return collections.filterMetadata('name', 'equals', country)


def GetRainMapID(start_date, end_date, region):
    """Map for displaying summed up images of specified measurement"""
    start_date = ee.Date(start_date)
    end_date = ee.Date(end_date)
    data = TRMM.filterDate(start_date, end_date).sort('system:time_start', False).sum().clip(region)
    data = data.visualize(min=800, max=2000, palette='000000, 0000FF, FDFF92, FF2700, FF00E7')
    return data.getMapId()


###############################################################################
#                                   Constants.                                #
###############################################################################


# Memcache is used to avoid exceeding our EE quota. Entries in the cache expire
# 24 hours after they are added. See:
# https://cloud.google.com/appengine/docs/python/memcache/
MEMCACHE_EXPIRATION = 60 * 60 * 24

COUNTRIES_PATH = 'static/polygons/countries.json'

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
urlfetch.set_default_fetch_deadline(59)


###############################################################################
#                               Building the ImageCollections.                #
###############################################################################

def Multiply(i, value):
    return i.multiply(value).copyProperties(i, ['system:time_start'])


TRMM = ee.ImageCollection('TRMM/3B42').select('precipitation').map(
    lambda i: Multiply(i, 3))
PERSIANN = ee.ImageCollection('NOAA/PERSIANN-CDR')
CHIRPS = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
CFSV2 = ee.ImageCollection('NOAA/CFSV2/FOR6H').select('Precipitation_rate_surface_6_Hour_Average').map(
    lambda i: Multiply(i, 60 * 60 * 6))
GLDAS = ee.ImageCollection('NASA/GLDAS/V021/NOAH/G025/T3H').select('Rainf_tavg').map(
    lambda i: Multiply(i, 60 * 60 * 3))

METHODS = [
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
    },
]
